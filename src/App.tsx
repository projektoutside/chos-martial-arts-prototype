import { AlertTriangle, Eye, EyeOff, Lock, User, X } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { publicAsset } from "./appAssets";
import {
  isSoftKeyboardLayoutActive,
  SOFT_KEYBOARD_CHANGE_EVENT,
  useSoftKeyboardViewport
} from "./softKeyboardViewport";
import { useSoftKeyboardEditor } from "./softKeyboardEditor";
import { useAppState } from "./state";
import { acknowledgeSupabaseWelcome, activateSupabaseAccount, clearSupabaseAuthSession, completeSupabaseInvitePassword, fetchSupabaseProfileOnboarding, isSupabaseAuthConfigured, isSupportedSupabaseLoginUsername, readSupabaseAuthSession, readSupabaseInviteCallback, signInSupabaseAccount, type SupabaseProfileOnboarding } from "./supabaseAccounts";
import { validateAccountPasswordChange } from "./accountPassword";
import type { AccountRole } from "./types";
import { FirstLoginWelcomeDialog } from "./FirstLoginWelcomeDialog";
import { DemoEnvironmentBadge } from "./DemoEnvironmentBadge";
import { initializeAppTheme } from "./theme";
import { hasSeenTestingUpdate, markTestingUpdateSeen, testingUpdateNotice } from "./testingUpdateNotice";
import {
  getInitialLaunchPhase,
  getLoginGateState,
  isPrototypeDeveloperLogin,
  isPrototypeManagerLogin,
  prototypeDeveloperLogin,
  prototypeManagerLogin,
  validateLoginForm
} from "./utils";

const LazyOperationsApp = lazy(() => import("./OperationsApp").then(({ OperationsApp }) => ({ default: OperationsApp })));
const TestOperationsApp = import.meta.env.MODE === "test" ? (await import("./OperationsApp")).OperationsApp : undefined;
const defaultLoginFailedMessage = "Please check your username and password and try again.";

type FullscreenCapableDocument = Document & {
  webkitFullscreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
};

type FullscreenCapableElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type PortraitLockOrientation = "portrait-primary" | "portrait";

type PortraitLockableScreenOrientation = ScreenOrientation & {
  lock?: (orientation: PortraitLockOrientation) => Promise<void> | void;
};

function getActiveFullscreenElement(doc: FullscreenCapableDocument) {
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? doc.msFullscreenElement ?? null;
}

function canRequestFullscreen(doc: FullscreenCapableDocument, element: FullscreenCapableElement) {
  const fullscreenEnabled = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled ?? doc.msFullscreenEnabled ?? true;
  return fullscreenEnabled !== false && Boolean(element.requestFullscreen ?? element.webkitRequestFullscreen ?? element.msRequestFullscreen);
}

function requestDocumentFullscreen() {
  const doc = document as FullscreenCapableDocument;
  const element = document.documentElement as FullscreenCapableElement;
  if (getActiveFullscreenElement(doc) || !canRequestFullscreen(doc, element)) return Promise.resolve();

  const requestFullscreen = element.requestFullscreen ?? element.webkitRequestFullscreen ?? element.msRequestFullscreen;
  return Promise.resolve(requestFullscreen.call(element)).catch(() => undefined);
}

function requestPortraitOrientationLock() {
  const orientation = window.screen.orientation as PortraitLockableScreenOrientation | undefined;
  const lockOrientation = orientation?.lock;
  if (!lockOrientation) return Promise.resolve();

  return Promise.resolve(lockOrientation.call(orientation, "portrait-primary"))
    .catch(() => Promise.resolve(lockOrientation.call(orientation, "portrait")).catch(() => undefined));
}

function useAppPortraitRuntime() {
  useEffect(() => {
    let requestInFlight = false;

    const requestPortraitRuntime = () => {
      if (requestInFlight || document.visibilityState === "hidden" || isSoftKeyboardLayoutActive()) return;
      requestInFlight = true;
      requestDocumentFullscreen()
        .then(() => requestPortraitOrientationLock())
        .finally(() => {
          requestInFlight = false;
        });
    };

    const interactionEvents = ["pointerdown", "touchstart", "click", "keydown"];
    interactionEvents.forEach((eventName) => {
      document.addEventListener(eventName, requestPortraitRuntime, { capture: true });
    });

    const documentRuntimeEvents = ["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange", "visibilitychange"];
    documentRuntimeEvents.forEach((eventName) => {
      document.addEventListener(eventName, requestPortraitRuntime);
    });

    const windowRuntimeEvents = ["orientationchange", "resize"];
    windowRuntimeEvents.forEach((eventName) => {
      window.addEventListener(eventName, requestPortraitRuntime);
    });
    window.visualViewport?.addEventListener("resize", requestPortraitRuntime);

    return () => {
      interactionEvents.forEach((eventName) => {
        document.removeEventListener(eventName, requestPortraitRuntime, { capture: true });
      });
      documentRuntimeEvents.forEach((eventName) => {
        document.removeEventListener(eventName, requestPortraitRuntime);
      });
      windowRuntimeEvents.forEach((eventName) => {
        window.removeEventListener(eventName, requestPortraitRuntime);
      });
      window.visualViewport?.removeEventListener("resize", requestPortraitRuntime);
    };
  }, []);
}

function App() {
  useAppPortraitRuntime();
  useEffect(() => {
    initializeAppTheme();
  }, []);
  const { session } = useAppState();
  const [launchComplete, setLaunchComplete] = useState(false);
  const [testingUpdateOpen, setTestingUpdateOpen] = useState(false);
  const [welcomeProfile, setWelcomeProfile] = useState<SupabaseProfileOnboarding | null>(null);
  const [welcomePending, setWelcomePending] = useState(false);
  const [welcomeError, setWelcomeError] = useState("");
  const loginGateState = getLoginGateState(session);
  const previousLoginGateStateRef = useRef(loginGateState);
  const loginJustCompleted = previousLoginGateStateRef.current === "login" && loginGateState !== "login";
  const [loginTransitionActive, setLoginTransitionActive] = useState(false);
  const revealLogin = useCallback(() => undefined, []);
  const completeLaunch = useCallback(() => {
    setLaunchComplete(true);
  }, []);

  useEffect(() => {
    previousLoginGateStateRef.current = loginGateState;
    if (!loginJustCompleted) return;

    setLoginTransitionActive(true);
    const timer = window.setTimeout(() => setLoginTransitionActive(false), 760);
    return () => window.clearTimeout(timer);
  }, [loginGateState, loginJustCompleted]);

  useEffect(() => {
    setTestingUpdateOpen(Boolean(session?.email && !hasSeenTestingUpdate(session.email)));
  }, [session?.email]);

  useEffect(() => {
    let cancelled = false;
    if (!session?.email || !isSupabaseAuthConfigured() || !readSupabaseAuthSession()) {
      setWelcomeProfile(null);
      return () => { cancelled = true; };
    }
    void fetchSupabaseProfileOnboarding().then((result) => {
      if (cancelled) return;
      setWelcomeProfile(result.ok && result.profile.status === "active" && !result.profile.welcomeSeenAt ? result.profile : null);
    });
    return () => { cancelled = true; };
  }, [session?.email]);

  const acknowledgeWelcome = useCallback(async () => {
    setWelcomePending(true);
    setWelcomeError("");
    const result = await acknowledgeSupabaseWelcome();
    setWelcomePending(false);
    if (result.ok) setWelcomeProfile(null);
    else setWelcomeError(result.message);
  }, []);

  const dismissTestingUpdate = useCallback(() => {
    if (session?.email) markTestingUpdateSeen(session.email);
    setTestingUpdateOpen(false);
  }, [session?.email]);

  if (loginGateState === "login") {
    return (
      <>
        <PortraitAppShell>
          <div className="auth-gate" data-testid="auth-gate">
            <AuthLaunchLogo animating={!launchComplete} />
            <LoginLandingPage visible={true} handoffActive={!launchComplete} interactive={launchComplete} />
            {!launchComplete && <LaunchLogoAnimation onReveal={revealLogin} onComplete={completeLaunch} />}
          </div>
        </PortraitAppShell>
        <ToastViewport />
      </>
    );
  }

  return (
    <>
      <PortraitAppShell>
        <div className={`authenticated-app-shell${loginJustCompleted || loginTransitionActive ? " is-login-transitioning" : ""}`} data-testid="authenticated-app-shell">
          {TestOperationsApp ? (
            <TestOperationsApp />
          ) : (
            <Suspense fallback={<div className="authenticated-app-loading" role="status" aria-live="polite">Loading Cho&apos;s workspace...</div>}>
              <LazyOperationsApp />
            </Suspense>
          )}
        </div>
        {testingUpdateOpen && !welcomeProfile && (
          <ModalShell label="What's New" onClose={dismissTestingUpdate} panelClass="modal-card testing-update-modal">
            <p className="testing-update-kicker">{testingUpdateNotice.date}</p>
            <p className="testing-update-version">Version {testingUpdateNotice.version}</p>
            <h2>What&apos;s New</h2>
            <h3>{testingUpdateNotice.title}</h3>
            <ul>
              {testingUpdateNotice.changes.map((change) => <li key={change}>{change}</li>)}
            </ul>
            <button className="testing-update-action" type="button" onClick={dismissTestingUpdate}>Got it</button>
          </ModalShell>
        )}
        {welcomeProfile && (
          <FirstLoginWelcomeDialog profile={welcomeProfile} pending={welcomePending} error={welcomeError} onAcknowledge={() => void acknowledgeWelcome()} />
        )}
      </PortraitAppShell>
      <ToastViewport />
    </>
  );
}

function PortraitAppShell({ children }: { children: ReactNode }) {
  useSoftKeyboardEditor();
  useSoftKeyboardViewport();
  return (
    <div className="portrait-app-shell" data-testid="portrait-app-shell" data-orientation-lock="portrait-primary" aria-label="Cho's Martial Arts portrait app frame">
      <DemoEnvironmentBadge />
      <div className="portrait-app-frame">
        {children}
      </div>
    </div>
  );
}

function ToastViewport() {
  const { toasts, dismissToast } = useAppState();
  return (
    <div className="toast-stack" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              onClick={() => {
                toast.onAction?.();
                dismissToast(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          )}
          <button aria-label="Dismiss notification" onClick={() => dismissToast(toast.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function AuthLaunchLogo({ animating }: { animating: boolean }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <img
      className={`auth-logo ${animating && !prefersReducedMotion ? "is-animating" : "is-settled"}`}
      src={publicAsset("682e95109aa21_chos-logo.png")}
      alt="Cho's Martial Arts"
    />
  );
}

function LaunchLogoAnimation({ onReveal, onComplete }: { onReveal: () => void; onComplete: () => void }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [phase] = useState(() => getInitialLaunchPhase(window.matchMedia("(prefers-reduced-motion: reduce)").matches));
  const [frameIndex, setFrameIndex] = useState(0);
  const frameCount = 60;
  const loaderDuration = phase === "final-logo" || prefersReducedMotion ? 950 : 3050;
  const revealDelay = phase === "final-logo" || prefersReducedMotion ? 80 : 1560;
  const fighterDuration = 1850;
  const frameSrc = `${publicAsset(`roundhouse-frames/frame-${String(frameIndex).padStart(2, "0")}.png`)}?v=clean-no-lines-2`;

  useEffect(() => {
    const imageSources = [
      ...Array.from({ length: frameCount }, (_, index) => `${publicAsset(`roundhouse-frames/frame-${String(index).padStart(2, "0")}.png`)}?v=clean-no-lines-2`),
      publicAsset("682e95109aa21_chos-logo.png")
    ];
    imageSources.forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || phase === "final-logo") {
      const revealTimer = window.setTimeout(onReveal, revealDelay);
      const timer = window.setTimeout(onComplete, loaderDuration);
      return () => {
        window.clearTimeout(revealTimer);
        window.clearTimeout(timer);
      };
    }

    const startedAt = performance.now();
    let animationFrame = 0;
    const render = (now: number) => {
      const elapsed = Math.max(0, now - startedAt);
      const fighterElapsed = Math.min(elapsed, fighterDuration);
      setFrameIndex(Math.min(frameCount - 1, Math.floor((fighterElapsed / fighterDuration) * (frameCount - 1))));
      if (elapsed < loaderDuration) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };
    animationFrame = window.requestAnimationFrame(render);
    const revealTimer = window.setTimeout(onReveal, revealDelay);
    const timer = window.setTimeout(onComplete, loaderDuration);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(revealTimer);
      window.clearTimeout(timer);
    };
  }, [fighterDuration, loaderDuration, onComplete, onReveal, phase, prefersReducedMotion, revealDelay]);

  return (
    <section className={`launch-loader ${prefersReducedMotion || phase === "final-logo" ? "is-reduced" : "is-playing"}`} aria-label="Cho's Martial Arts loading animation">
      <div className="launch-screen-backdrop"></div>
      <div className="launch-stage" aria-hidden="true">
        <div className="launch-stage-haze"></div>
        <div className="launch-floor-glow"></div>
        {!prefersReducedMotion && phase !== "final-logo" && <img className="launch-fighter-frame" src={frameSrc} alt="" />}
        <div className="launch-impact-flash"></div>
        <div className="launch-logo-aura"></div>
      </div>
    </section>
  );
}

function LoginLandingPage({
  visible,
  handoffActive = false,
  interactive = true
}: {
  visible: boolean;
  handoffActive?: boolean;
  interactive?: boolean;
}) {
  const { activateCreatedAccount, login, loginCreatedAccount, logout, showToast } = useAppState();
  const navigate = useNavigate();
  const loginLandingRef = useRef<HTMLElement | null>(null);
  const portraitStageRef = useRef<HTMLDivElement | null>(null);
  const usernameFieldRef = useRef<HTMLLabelElement | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [portraitVisible, setPortraitVisible] = useState(true);
  const [loginFailedOpen, setLoginFailedOpen] = useState(false);
  const [loginFailedMessage, setLoginFailedMessage] = useState(defaultLoginFailedMessage);
  const [loginPending, setLoginPending] = useState(false);
  const [passwordSetup, setPasswordSetup] = useState(() => readSupabaseInviteCallback());
  const [setupPassword, setSetupPassword] = useState("");
  const [setupConfirmation, setSetupConfirmation] = useState("");
  const [setupMessage, setSetupMessage] = useState("");
  const [activationOpen, setActivationOpen] = useState(false);
  const [activationStep, setActivationStep] = useState<"credentials" | "password">("credentials");
  const [activationHostedSession, setActivationHostedSession] = useState<{ sessionEmail: string; role: AccountRole; studentId?: string } | null>(null);
  const [activationPending, setActivationPending] = useState(false);
  const [activationMessage, setActivationMessage] = useState("");
  const [activationForm, setActivationForm] = useState({
    username: "",
    temporaryPassword: "",
    password: "",
    confirmation: ""
  });
  const supabaseConfigured = isSupabaseAuthConfigured();
  const loginLandingStyle = { "--login-bg-image": `url("${publicAsset("NewFinalBackground.png")}")` } as CSSProperties;

  useEffect(() => {
    const landing = loginLandingRef.current;
    const portraitStage = portraitStageRef.current;
    const usernameField = usernameFieldRef.current;
    if (!portraitVisible || !landing || !portraitStage || !usernameField) return undefined;

    let animationFrame = 0;
    const setPortraitAnchor = () => {
      const loginPanel = usernameField.closest<HTMLElement>(".login-panel");
      const previousPanelAnimation = loginPanel?.style.animation ?? "";
      const previousPanelTransform = loginPanel?.style.transform ?? "";
      if (loginPanel) {
        loginPanel.style.animation = "none";
        loginPanel.style.transform = "none";
      }
      const usernameRect = usernameField.getBoundingClientRect();
      if (loginPanel) {
        loginPanel.style.animation = previousPanelAnimation;
        loginPanel.style.transform = previousPanelTransform;
      }
      const portraitRect = portraitStage.getBoundingClientRect();
      const portraitStyles = window.getComputedStyle(portraitStage);
      const portraitHeight = parseFloat(portraitStyles.height) || portraitRect.height;
      const portraitWidth = parseFloat(portraitStyles.width) || portraitRect.width;
      if (usernameRect.height <= 0 || portraitHeight <= 0 || portraitWidth <= 0) return;

      const portraitImage = portraitStage.querySelector("img");
      const portraitImageRatio = portraitImage?.naturalWidth && portraitImage.naturalHeight
        ? portraitImage.naturalHeight / portraitImage.naturalWidth
        : 1;
      const visiblePortraitHeight = Math.min(portraitHeight, portraitWidth * portraitImageRatio);
      const usernameUnderlap = Math.min(6, Math.max(4, usernameRect.height * 0.1));
      const fieldAnchoredCenterY = usernameRect.top + usernameUnderlap - portraitHeight / 2;
      const logo = landing.closest(".auth-gate")?.querySelector(".auth-logo") as HTMLElement | null;
      const previousLogoAnimation = logo?.style.animation ?? "";
      if (logo) logo.style.animation = "none";
      const logoRect = logo?.getBoundingClientRect();
      if (logo) logo.style.animation = previousLogoAnimation;
      const logoSafeGap = 12;
      const logoSafeCenterY = logoRect && logoRect.height > 0
        ? logoRect.bottom + logoSafeGap + visiblePortraitHeight - portraitHeight / 2
        : 0;
      const anchoredCenterY = Math.max(fieldAnchoredCenterY, logoSafeCenterY);
      landing.style.setProperty("--login-portrait-anchor-y", `${Math.round(anchoredCenterY * 100) / 100}px`);
    };
    const updatePortraitAnchor = () => {
      if (isSoftKeyboardLayoutActive()) return;
      window.cancelAnimationFrame(animationFrame);
      setPortraitAnchor();
      animationFrame = window.requestAnimationFrame(setPortraitAnchor);
    };
    const handleSoftKeyboardChange = (event: Event) => {
      const state = (event as CustomEvent<{ state: "open" | "closed" }>).detail?.state;
      if (state === "closed") updatePortraitAnchor();
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(updatePortraitAnchor);
    resizeObserver?.observe(landing);
    resizeObserver?.observe(portraitStage);
    resizeObserver?.observe(usernameField);
    window.addEventListener("resize", updatePortraitAnchor);
    window.addEventListener("orientationchange", updatePortraitAnchor);
    window.visualViewport?.addEventListener("resize", updatePortraitAnchor);
    document.addEventListener(SOFT_KEYBOARD_CHANGE_EVENT, handleSoftKeyboardChange);
    void document.fonts?.ready.then(updatePortraitAnchor).catch(() => undefined);
    updatePortraitAnchor();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePortraitAnchor);
      window.removeEventListener("orientationchange", updatePortraitAnchor);
      window.visualViewport?.removeEventListener("resize", updatePortraitAnchor);
      document.removeEventListener(SOFT_KEYBOARD_CHANGE_EVENT, handleSoftKeyboardChange);
      landing.style.removeProperty("--login-portrait-anchor-y");
    };
  }, [handoffActive, portraitVisible, visible]);

  const failLogin = (message: string, dialogMessage = defaultLoginFailedMessage) => {
    showToast(message);
    setLoginFailedMessage(dialogMessage);
    setLoginFailedOpen(true);
  };

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateLoginForm(loginForm);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      failLogin("Enter a username and password.");
      return;
    }

    if (supabaseConfigured && isSupportedSupabaseLoginUsername(loginForm.username)) {
      setLoginPending(true);
      try {
        const supabaseLogin = await signInSupabaseAccount(loginForm);
        if (supabaseLogin.status === "authenticated") {
          login(supabaseLogin.sessionEmail, true, supabaseLogin.role, supabaseLogin.studentId);
          navigate("/");
          return;
        }
        if (supabaseLogin.status === "activation-required") {
          setActivationForm({ username: loginForm.username, temporaryPassword: loginForm.password, password: "", confirmation: "" });
          setActivationHostedSession({ sessionEmail: supabaseLogin.sessionEmail, role: supabaseLogin.role, studentId: supabaseLogin.studentId });
          setActivationStep("password");
          setActivationMessage("");
          setActivationOpen(true);
          return;
        }
        if (supabaseLogin.status === "inactive") {
          failLogin("The account is inactive.");
          return;
        }
        if (supabaseLogin.status === "backend-inactive") {
          failLogin(supabaseLogin.message, supabaseLogin.message);
          return;
        }
        failLogin("Check the Supabase username and password.");
        return;
      } finally {
        setLoginPending(false);
      }
    }

    if (isPrototypeDeveloperLogin(loginForm)) {
      login(prototypeDeveloperLogin.email, true, prototypeDeveloperLogin.role);
      navigate("/");
      return;
    }

    if (!supabaseConfigured) {
      const createdAccount = loginCreatedAccount(loginForm);
      if (createdAccount?.status === "activation-required") {
        setActivationForm({ username: loginForm.username, temporaryPassword: loginForm.password, password: "", confirmation: "" });
        setActivationHostedSession(null);
        setActivationStep("password");
        setActivationMessage("");
        setActivationOpen(true);
        return;
      }
      if (createdAccount?.status === "authenticated") {
        navigate("/");
        return;
      }
    }

    if (isPrototypeManagerLogin(loginForm)) {
      login(prototypeManagerLogin.email, true, prototypeManagerLogin.role);
      navigate("/");
      return;
    }
    failLogin("Check the username and password.");
  };

  const submitPasswordSetup = async (event: FormEvent) => {
    event.preventDefault();
    const validationMessage = validateAccountPasswordChange(setupPassword, setupConfirmation);
    if (validationMessage) {
      setSetupMessage(validationMessage);
      return;
    }
    setLoginPending(true);
    const result = await completeSupabaseInvitePassword(setupPassword);
    setLoginPending(false);
    if (result.status !== "ok") {
      setSetupMessage(result.status === "not-configured" ? "Account setup is unavailable." : result.message);
      return;
    }
    setSetupMessage("Password saved. Sign in with your email and new password.");
    setPasswordSetup({ status: "none" });
  };

  const openAccountActivation = () => {
    setActivationForm({ username: loginForm.username, temporaryPassword: "", password: "", confirmation: "" });
    setActivationStep("credentials");
    setActivationHostedSession(null);
    setActivationMessage("");
    setActivationOpen(true);
  };

  const closeAccountActivation = () => {
    if (activationPending) return;
    clearSupabaseAuthSession();
    setActivationOpen(false);
    setActivationStep("credentials");
    setActivationHostedSession(null);
    setActivationForm({ username: "", temporaryPassword: "", password: "", confirmation: "" });
    setActivationMessage("");
  };

  const submitAccountActivation = async (event: FormEvent) => {
    event.preventDefault();
    setActivationMessage("");

    if (activationStep === "credentials") {
      if (!activationForm.username.trim() || !activationForm.temporaryPassword.trim()) {
        setActivationMessage("Enter the account name and temporary password you were given.");
        return;
      }
      setActivationPending(true);
      if (supabaseConfigured) {
        const result = await signInSupabaseAccount({ username: activationForm.username, password: activationForm.temporaryPassword });
        setActivationPending(false);
        if (result.status === "activation-required") {
          setActivationHostedSession({ sessionEmail: result.sessionEmail, role: result.role, studentId: result.studentId });
          setActivationStep("password");
          return;
        }
        clearSupabaseAuthSession();
        if (result.status === "authenticated") {
          setActivationMessage("This account is already active. Use Sign In.");
          return;
        }
        if (result.status === "inactive") {
          setActivationMessage("This account is inactive. Ask a Manager or Developer for help.");
          return;
        }
        setActivationMessage(result.status === "backend-inactive" || result.status === "error" ? result.message : "Check the account name and temporary password.");
        return;
      }

      const result = loginCreatedAccount({ username: activationForm.username, password: activationForm.temporaryPassword });
      setActivationPending(false);
      if (result?.status === "activation-required") {
        setActivationStep("password");
        return;
      }
      if (result?.status === "authenticated") {
        logout();
        setActivationMessage("This account is already active. Use Sign In.");
        return;
      }
      setActivationMessage("Check the account name and temporary password.");
      return;
    }

    const validationMessage = validateAccountPasswordChange(activationForm.password, activationForm.confirmation);
    if (validationMessage) {
      setActivationMessage(validationMessage);
      return;
    }
    setActivationPending(true);
    if (supabaseConfigured) {
      const result = await activateSupabaseAccount(activationForm.password, activationForm.temporaryPassword);
      setActivationPending(false);
      if (result.status !== "ok") {
        setActivationMessage(result.status === "not-configured" ? "Account activation is unavailable." : result.message);
        if (result.status === "session-expired") setActivationStep("credentials");
        return;
      }
      if (!activationHostedSession) {
        clearSupabaseAuthSession();
        setActivationStep("credentials");
        setActivationMessage("Your temporary sign-in expired. Start account access again.");
        return;
      }
      login(activationHostedSession.sessionEmail, true, activationHostedSession.role, activationHostedSession.studentId);
    } else {
      const result = activateCreatedAccount({
        username: activationForm.username,
        temporaryPassword: activationForm.temporaryPassword,
        password: activationForm.password
      });
      setActivationPending(false);
      if (result.status === "error") {
        setActivationMessage(result.message);
        return;
      }
    }
    setActivationForm({ username: "", temporaryPassword: "", password: "", confirmation: "" });
    setActivationOpen(false);
    navigate("/");
  };

  return (
    <section
      ref={loginLandingRef}
      className={`login-landing ${visible ? "is-visible" : ""} ${handoffActive ? "is-handoff" : ""}`}
      style={loginLandingStyle}
      aria-label="Cho's Martial Arts login"
      data-interaction-ready={interactive}
      inert={!interactive}
    >
      <div className="login-scrim"></div>
      <button
        className="login-portrait-toggle is-above-launch"
        type="button"
        aria-pressed={portraitVisible}
        aria-label={portraitVisible ? "Hide portrait background" : "Show portrait background"}
        title={portraitVisible ? "Hide portrait background" : "Show portrait background"}
        onClick={() => setPortraitVisible((visible) => !visible)}
      >
        {portraitVisible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      {portraitVisible && (
        <div ref={portraitStageRef} className="login-portrait-stage" aria-hidden="true">
          <img src={publicAsset("Perfect1.png")} alt="" draggable={false} />
        </div>
      )}
      <div className="login-panel-wrap">
        <form className="login-panel" onSubmit={submitLogin}>
          <label ref={usernameFieldRef} className="login-field">
            <User size={34} aria-hidden="true" />
            <span className="sr-only">Email or username</span>
            <input
              autoComplete="username"
              inputMode="email"
              aria-label="Email or username"
              placeholder="Username"
              value={loginForm.username}
              onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
            />
          </label>
          {errors.username && <p className="login-error">{errors.username}</p>}
          <div className="login-field">
            <Lock size={32} aria-hidden="true" />
            <span id="login-password-label" className="sr-only">Password</span>
            <input
              aria-labelledby="login-password-label"
              autoComplete="current-password"
              placeholder="Password"
              type={passwordVisible ? "text" : "password"}
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
            />
            <button className="login-field-action" type="button" aria-label={passwordVisible ? "Hide password" : "Show password"} onClick={() => setPasswordVisible(!passwordVisible)}>
              {passwordVisible ? <EyeOff size={32} /> : <Eye size={32} />}
            </button>
          </div>
          {errors.password && <p className="login-error">{errors.password}</p>}
          <button className="login-submit" type="submit" disabled={loginPending}>
            {loginPending ? "Signing In..." : "Sign In"}
          </button>
          <div className="login-secondary-actions">
            <button className="login-create login-access-new-account" type="button" onClick={openAccountActivation}>
              Access New Account
            </button>
          </div>
          <p className="login-invite-only-note">Use Sign In for an active account, or Access New Account with the temporary password you were given.</p>
          {setupMessage && <p className="login-invite-only-note" role="status">{setupMessage}</p>}
        </form>
        <div className="login-divider" aria-hidden="true">
          <span></span>
          <span className="yin-yang">☯</span>
          <span></span>
        </div>
      </div>
      {loginFailedOpen && (
        <ModalShell label="Login failed" onClose={() => setLoginFailedOpen(false)} panelClass="modal-card login-failed-modal">
          <div className="login-failed-content">
            <span className="login-failed-icon" aria-hidden="true">
              <AlertTriangle size={24} strokeWidth={2.4} />
            </span>
            <h2>Login failed</h2>
            <p>{loginFailedMessage}</p>
            <button className="btn btn-red login-failed-action" type="button" onClick={() => setLoginFailedOpen(false)}>
              Try Again
            </button>
          </div>
        </ModalShell>
      )}
      {activationOpen && (
        <ModalShell label="Access new account" onClose={closeAccountActivation} panelClass="modal-card login-failed-modal account-activation-modal">
          <form className="login-failed-content account-activation-form" onSubmit={submitAccountActivation}>
            <h2>{activationStep === "credentials" ? "Access your new account" : "Create your personal password"}</h2>
            <p>{activationStep === "credentials" ? "Enter the account name and temporary password a Developer or Manager gave you." : "Your temporary credentials are correct. Replace the temporary password before entering the app."}</p>
            {activationStep === "credentials" ? (
              <>
                <label><span>Account name</span><input aria-label="Account name" autoComplete="username" value={activationForm.username} onChange={(event) => setActivationForm({ ...activationForm, username: event.target.value })} /></label>
                <label><span>Temporary password</span><input aria-label="Temporary password" type="password" autoComplete="current-password" value={activationForm.temporaryPassword} onChange={(event) => setActivationForm({ ...activationForm, temporaryPassword: event.target.value })} /></label>
              </>
            ) : (
              <>
                <label className="sr-only"><span>Account name for password manager</span><input aria-label="Account name for password manager" autoComplete="username" value={activationForm.username} readOnly tabIndex={-1} /></label>
                <label><span>New password</span><input aria-label="New account password" type="password" autoComplete="new-password" value={activationForm.password} onChange={(event) => setActivationForm({ ...activationForm, password: event.target.value })} /></label>
                <label><span>Confirm password</span><input aria-label="Confirm account password" type="password" autoComplete="new-password" value={activationForm.confirmation} onChange={(event) => setActivationForm({ ...activationForm, confirmation: event.target.value })} /></label>
              </>
            )}
            {activationMessage && <p className="login-error" role="status">{activationMessage}</p>}
            <div className="account-activation-actions">
              <button className="btn btn-ghost" type="button" onClick={closeAccountActivation} disabled={activationPending}>Cancel</button>
              <button className="btn btn-red" type="submit" disabled={activationPending}>
                {activationPending ? "Checking..." : activationStep === "credentials" ? "Continue" : "Activate Account"}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
      {passwordSetup.status === "ready" && (
        <ModalShell label="Set your password" onClose={() => undefined} panelClass="modal-card login-failed-modal">
          <form className="login-failed-content account-activation-form" onSubmit={submitPasswordSetup}>
            <h2>Set your password</h2>
            <p>Create a strong password to finish accepting your Cho&apos;s invitation.</p>
            <label>New password<input aria-label="New password" type="password" autoComplete="new-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} /></label>
            <label>Confirm new password<input aria-label="Confirm new password" type="password" autoComplete="new-password" value={setupConfirmation} onChange={(event) => setSetupConfirmation(event.target.value)} /></label>
            {setupMessage && <p className="login-error" role="alert">{setupMessage}</p>}
            <button className="btn btn-red login-failed-action" type="submit" disabled={loginPending}>{loginPending ? "Saving..." : "Save Password"}</button>
          </form>
        </ModalShell>
      )}
      {passwordSetup.status === "error" && (
        <ModalShell label="Invitation link problem" onClose={() => setPasswordSetup({ status: "none" })} panelClass="modal-card login-failed-modal">
          <div className="login-failed-content"><h2>Invitation link problem</h2><p>{passwordSetup.message}</p><button className="btn btn-red login-failed-action" type="button" onClick={() => setPasswordSetup({ status: "none" })}>Return to Sign In</button></div>
        </ModalShell>
      )}
    </section>
  );
}

function ModalShell({ label, onClose, panelClass, children }: { label: string; onClose: () => void; panelClass: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      const openDialogs = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'));
      if (openDialogs.at(-1) !== panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={panelClass} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={panelRef}>
        {children}
      </div>
    </div>
  );
}

export default App;
