import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router";
import {
  guidedOnboardingProgressStorageKey,
  loadGuidedOnboardingProgress,
  normalizeGuidedOnboardingFeatureId,
  mergeGuidedOnboardingFeatureIds,
  persistGuidedOnboardingProgress,
  readLocalGuidedOnboardingProgress,
  writeLocalGuidedOnboardingProgress
} from "./onboardingProgress";
import type { AccountRole } from "./types";

type GuidedOnboardingContextValue = {
  hasSeenFeature: (featureId: string) => boolean;
  markFeatureSeen: (featureId: string) => void;
  progressReady: boolean;
};

type GuidedTarget = {
  element: HTMLElement;
  featureId: string;
  instruction: string;
  title: string;
};

type TargetPosition = {
  spotlight: { top: number; left: number; width: number; height: number };
  coach: { top: number; left: number; width: number };
  placement: "above" | "below";
};

const GuidedOnboardingContext = createContext<GuidedOnboardingContextValue | undefined>(undefined);
// These IDs are durable user-history keys. New guided controls must get a new ID,
// and an existing ID must never be renamed or reused for a different action.
const targetSelector = "[data-guided-onboarding-id]";
const starterFeatureId = (role?: AccountRole) => `starter.${role ?? "user"}.profile-route.v1`;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isElementAvailable(element: HTMLElement) {
  if (element.closest("[hidden], [aria-hidden=\"true\"]")) return false;
  if (element.matches(":disabled, [aria-disabled=\"true\"]")) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 || import.meta.env.MODE === "test";
}

function activeAppModal() {
  return [...document.querySelectorAll<HTMLElement>("[aria-modal=\"true\"]")]
    .reverse()
    .find((element) => isElementAvailable(element));
}

function findNextTarget(seenFeatureIds: ReadonlySet<string>) {
  if (document.querySelector('[data-guided-onboarding-defer="true"]')) return undefined;
  const modal = activeAppModal();
  const targets = [...document.querySelectorAll<HTMLElement>(targetSelector)]
    .filter((element) => {
      const featureId = normalizeGuidedOnboardingFeatureId(element.dataset.guidedOnboardingId);
      return Boolean(featureId && !seenFeatureIds.has(featureId) && isElementAvailable(element) && (!modal || modal.contains(element)));
    })
    .map((element, index) => ({
      element,
      index,
      priority: Number(element.dataset.guidedOnboardingPriority ?? 1000)
    }))
    .sort((left, right) => left.priority - right.priority || left.index - right.index);
  const next = targets[0]?.element;
  if (!next) return undefined;
  const featureId = normalizeGuidedOnboardingFeatureId(next.dataset.guidedOnboardingId);
  const title = next.dataset.guidedOnboardingTitle?.trim();
  const instruction = next.dataset.guidedOnboardingInstruction?.trim();
  if (!featureId || !title || !instruction) return undefined;
  return { element: next, featureId, title, instruction } satisfies GuidedTarget;
}

function measureTarget(element: HTMLElement): TargetPosition {
  const padding = 8;
  const minimumTargetSize = 44;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1024;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
  const rect = element.getBoundingClientRect();
  const width = Math.max(rect.width + padding * 2, minimumTargetSize);
  const height = Math.max(rect.height + padding * 2, minimumTargetSize);
  const left = clamp(rect.left - padding - Math.max(0, minimumTargetSize - rect.width) / 2, 6, Math.max(6, viewportWidth - width - 6));
  const top = clamp(rect.top - padding - Math.max(0, minimumTargetSize - rect.height) / 2, 6, Math.max(6, viewportHeight - height - 6));
  const coachWidth = Math.min(360, Math.max(260, viewportWidth - 24));
  const estimatedCoachHeight = 154;
  const canFitBelow = top + height + estimatedCoachHeight + 24 <= viewportHeight;
  const placement = canFitBelow || top < estimatedCoachHeight + 28 ? "below" : "above";
  const coachTop = placement === "below"
    ? clamp(top + height + 12, 12, Math.max(12, viewportHeight - estimatedCoachHeight - 12))
    : clamp(top - estimatedCoachHeight - 12, 12, Math.max(12, viewportHeight - estimatedCoachHeight - 12));
  const coachLeft = clamp(left + width / 2 - coachWidth / 2, 12, Math.max(12, viewportWidth - coachWidth - 12));
  return {
    spotlight: { top, left, width, height },
    coach: { top: coachTop, left: coachLeft, width: coachWidth },
    placement
  };
}

export function useGuidedOnboarding() {
  const context = useContext(GuidedOnboardingContext);
  if (!context) throw new Error("useGuidedOnboarding must be used inside GuidedOnboardingProvider.");
  return context;
}

export function GuidedOnboardingProvider({
  accountRole,
  children,
  enabled = import.meta.env.MODE !== "test",
  sessionEmail
}: {
  accountRole?: AccountRole;
  children: ReactNode;
  enabled?: boolean;
  sessionEmail?: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [seenFeatureIds, setSeenFeatureIds] = useState<Set<string>>(() => new Set(readLocalGuidedOnboardingProgress(sessionEmail)));
  const [progressReady, setProgressReady] = useState(false);
  const [starterPrepared, setStarterPrepared] = useState(false);
  const [activeTarget, setActiveTarget] = useState<GuidedTarget>();
  const [targetPosition, setTargetPosition] = useState<TargetPosition>();
  const seenFeatureIdsRef = useRef(seenFeatureIds);
  const activeTargetRef = useRef(activeTarget);
  const persistQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!enabled) {
      setProgressReady(true);
      setStarterPrepared(true);
      return;
    }
    let cancelled = false;
    setProgressReady(false);
    setStarterPrepared(false);
    const localFeatureIds = readLocalGuidedOnboardingProgress(sessionEmail);
    const localSet = new Set(localFeatureIds);
    seenFeatureIdsRef.current = localSet;
    setSeenFeatureIds(localSet);
    void loadGuidedOnboardingProgress(sessionEmail)
      .then((loadedFeatureIds) => {
        if (cancelled) return;
        const next = new Set(loadedFeatureIds);
        seenFeatureIdsRef.current = next;
        setSeenFeatureIds(next);
        setProgressReady(true);
      })
      .catch(() => {
        // Fail closed: if cross-device history cannot be verified, do not risk
        // replaying a tutorial the user may already have completed elsewhere.
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, sessionEmail]);

  const markFeatureSeen = useCallback((featureId: string) => {
    const nextFeatureIds = mergeGuidedOnboardingFeatureIds(seenFeatureIdsRef.current, [featureId]);
    if (nextFeatureIds.length === seenFeatureIdsRef.current.size) return;
    const next = new Set(nextFeatureIds);
    seenFeatureIdsRef.current = next;
    setSeenFeatureIds(next);
    writeLocalGuidedOnboardingProgress(sessionEmail, nextFeatureIds);
    persistQueueRef.current = persistQueueRef.current
      .catch(() => undefined)
      .then(() => persistGuidedOnboardingProgress(sessionEmail, [featureId]))
      .catch(() => undefined);
  }, [sessionEmail]);

  useEffect(() => {
    const storageKey = guidedOnboardingProgressStorageKey(sessionEmail);
    const syncProgressFromStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== storageKey) return;
      const mergedIds = mergeGuidedOnboardingFeatureIds(seenFeatureIdsRef.current, readLocalGuidedOnboardingProgress(sessionEmail));
      const next = new Set(mergedIds);
      seenFeatureIdsRef.current = next;
      setSeenFeatureIds(next);
    };
    window.addEventListener("storage", syncProgressFromStorage);
    return () => window.removeEventListener("storage", syncProgressFromStorage);
  }, [sessionEmail]);

  const hasSeenFeature = useCallback((featureId: string) => seenFeatureIdsRef.current.has(featureId), []);

  useEffect(() => {
    if (!enabled || !progressReady || !accountRole) return;
    const featureId = starterFeatureId(accountRole);
    if (!seenFeatureIdsRef.current.has(featureId)) {
      markFeatureSeen(featureId);
      if (location.pathname !== "/profile") navigate("/profile", { replace: true });
    }
    setStarterPrepared(true);
  }, [accountRole, enabled, location.pathname, markFeatureSeen, navigate, progressReady]);

  const scanForTarget = useCallback(() => {
    if (!enabled || !progressReady || !starterPrepared) {
      setActiveTarget(undefined);
      return;
    }
    const nextTarget = findNextTarget(seenFeatureIdsRef.current);
    setActiveTarget((current) => {
      if (!current || !nextTarget) return nextTarget;
      return current.featureId === nextTarget.featureId && current.element === nextTarget.element ? current : nextTarget;
    });
  }, [enabled, progressReady, starterPrepared]);

  useEffect(() => {
    scanForTarget();
    const observer = new MutationObserver(scanForTarget);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["aria-hidden", "aria-modal", "disabled", "hidden", "data-guided-onboarding-defer", "data-guided-onboarding-id"],
      childList: true,
      subtree: true
    });
    return () => observer.disconnect();
  }, [location.key, scanForTarget, seenFeatureIds]);

  useLayoutEffect(() => {
    activeTargetRef.current = activeTarget;
    if (!activeTarget) {
      setTargetPosition(undefined);
      return;
    }
    activeTarget.element.scrollIntoView?.({ behavior: "auto", block: "center", inline: "nearest" });
    const updatePosition = () => setTargetPosition(measureTarget(activeTarget.element));
    updatePosition();
    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updatePosition);
    resizeObserver?.observe(activeTarget.element);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [activeTarget]);

  useEffect(() => {
    if (!activeTarget) return;
    const target = activeTarget.element;
    const previousDescribedBy = target.getAttribute("aria-describedby");
    target.setAttribute("aria-describedby", "guided-onboarding-instruction");
    target.focus({ preventScroll: true });
    document.documentElement.classList.add("guided-onboarding-is-active");

    const blockUnrelatedPointer = (event: Event) => {
      const currentTarget = activeTargetRef.current?.element;
      if (currentTarget && event.target instanceof Node && currentTarget.contains(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const blockBackgroundScroll = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };
    const completeTargetClick = (event: MouseEvent) => {
      const current = activeTargetRef.current;
      if (!current || !(event.target instanceof Node) || !current.element.contains(event.target)) return;
      markFeatureSeen(current.featureId);
      setActiveTarget(undefined);
    };
    const lockKeyboard = (event: KeyboardEvent) => {
      const currentTarget = activeTargetRef.current?.element;
      const isTargetEvent = currentTarget && event.target instanceof Node && currentTarget.contains(event.target);
      if (isTargetEvent && (event.key === "Enter" || event.key === " ")) return;
      event.preventDefault();
      event.stopPropagation();
      currentTarget?.focus({ preventScroll: true });
    };
    const retainTargetFocus = (event: FocusEvent) => {
      const currentTarget = activeTargetRef.current?.element;
      if (!currentTarget || event.target instanceof Node && currentTarget.contains(event.target)) return;
      event.preventDefault();
      currentTarget.focus({ preventScroll: true });
    };

    document.addEventListener("pointerdown", blockUnrelatedPointer, true);
    document.addEventListener("click", completeTargetClick, true);
    document.addEventListener("click", blockUnrelatedPointer, true);
    document.addEventListener("keydown", lockKeyboard, true);
    document.addEventListener("focusin", retainTargetFocus, true);
    document.addEventListener("wheel", blockBackgroundScroll, { capture: true, passive: false });
    document.addEventListener("touchmove", blockBackgroundScroll, { capture: true, passive: false });
    return () => {
      document.documentElement.classList.remove("guided-onboarding-is-active");
      if (previousDescribedBy) target.setAttribute("aria-describedby", previousDescribedBy);
      else target.removeAttribute("aria-describedby");
      document.removeEventListener("pointerdown", blockUnrelatedPointer, true);
      document.removeEventListener("click", completeTargetClick, true);
      document.removeEventListener("click", blockUnrelatedPointer, true);
      document.removeEventListener("keydown", lockKeyboard, true);
      document.removeEventListener("focusin", retainTargetFocus, true);
      document.removeEventListener("wheel", blockBackgroundScroll, true);
      document.removeEventListener("touchmove", blockBackgroundScroll, true);
    };
  }, [activeTarget, markFeatureSeen]);

  const contextValue = useMemo<GuidedOnboardingContextValue>(() => ({ hasSeenFeature, markFeatureSeen, progressReady }), [hasSeenFeature, markFeatureSeen, progressReady]);

  return (
    <GuidedOnboardingContext.Provider value={contextValue}>
      {children}
      {activeTarget && targetPosition && createPortal(
        <GuidedOnboardingOverlay target={activeTarget} position={targetPosition} />,
        document.body
      )}
    </GuidedOnboardingContext.Provider>
  );
}

function GuidedOnboardingOverlay({ target, position }: { target: GuidedTarget; position: TargetPosition }) {
  const spotlightStyle = {
    "--guided-onboarding-top": `${position.spotlight.top}px`,
    "--guided-onboarding-left": `${position.spotlight.left}px`,
    "--guided-onboarding-width": `${position.spotlight.width}px`,
    "--guided-onboarding-height": `${position.spotlight.height}px`
  } as CSSProperties;
  const coachStyle = {
    "--guided-onboarding-coach-top": `${position.coach.top}px`,
    "--guided-onboarding-coach-left": `${position.coach.left}px`,
    "--guided-onboarding-coach-width": `${position.coach.width}px`
  } as CSSProperties;
  return (
    <div
      className="guided-onboarding-layer"
      aria-live="assertive"
      data-guided-onboarding-active-id={target.featureId}
      data-testid="guided-onboarding-layer"
    >
      <div className="guided-onboarding-spotlight" style={spotlightStyle} aria-hidden="true" />
      <section className={`guided-onboarding-coach guided-onboarding-coach--${position.placement}`} style={coachStyle} role="region" aria-label="Guided app tutorial">
        <p>ONE-TIME GUIDE</p>
        <h2>{target.title}</h2>
        <span id="guided-onboarding-instruction">{target.instruction}</span>
        <strong>Tap the highlighted control to continue.</strong>
      </section>
    </div>
  );
}
