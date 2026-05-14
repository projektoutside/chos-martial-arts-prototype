import { useCallback, useEffect, useRef, useState } from "react";
import type { DojoDoorPhase } from "./dojoSceneTypes";

interface UseDojoDoorMachineOptions {
  initialPanelId: string;
  reducedMotion?: boolean;
  openDurationMs?: number;
  closeDurationMs?: number;
  frameDelayMs?: number;
}

export function useDojoDoorMachine({
  initialPanelId,
  reducedMotion = false,
  openDurationMs = 820,
  closeDurationMs = 580,
  frameDelayMs = 16
}: UseDojoDoorMachineOptions) {
  const [phase, setPhaseState] = useState<DojoDoorPhase>("closed");
  const [activePanelId, setActivePanelId] = useState(initialPanelId);
  const [selectedPanelId, setSelectedPanelId] = useState(initialPanelId);
  const phaseRef = useRef<DojoDoorPhase>("closed");
  const activePanelIdRef = useRef(initialPanelId);
  const latestRequestRef = useRef<string | null>(null);
  const runningRef = useRef(false);
  const mountedRef = useRef(true);
  const timersRef = useRef<number[]>([]);

  const openMs = reducedMotion ? 1 : openDurationMs;
  const closeMs = reducedMotion ? 1 : closeDurationMs;
  const frameMs = reducedMotion ? 1 : frameDelayMs;

  const setPhase = useCallback((nextPhase: DojoDoorPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((resolve) => {
      const timer = window.setTimeout(() => {
        timersRef.current = timersRef.current.filter((entry) => entry !== timer);
        resolve();
      }, ms);
      timersRef.current.push(timer);
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
    };
  }, []);

  useEffect(() => {
    setActivePanelId(initialPanelId);
    setSelectedPanelId(initialPanelId);
    activePanelIdRef.current = initialPanelId;
    latestRequestRef.current = null;
    setPhase("closed");
  }, [initialPanelId, setPhase]);

  const runQueue = useCallback(async () => {
    if (runningRef.current) {
      return;
    }
    runningRef.current = true;

    while (mountedRef.current && latestRequestRef.current) {
      let nextPanelId = latestRequestRef.current;
      latestRequestRef.current = null;

      if (phaseRef.current === "open" && activePanelIdRef.current === nextPanelId) {
        continue;
      }

      if (phaseRef.current !== "closed") {
        setPhase("closing");
        await sleep(closeMs);
        if (!mountedRef.current) {
          break;
        }
        setPhase("closed");
      }

      if (latestRequestRef.current) {
        nextPanelId = latestRequestRef.current;
        latestRequestRef.current = null;
      }

      activePanelIdRef.current = nextPanelId;
      setActivePanelId(nextPanelId);
      await sleep(frameMs);
      if (!mountedRef.current) {
        break;
      }

      if (latestRequestRef.current) {
        nextPanelId = latestRequestRef.current;
        latestRequestRef.current = null;
        activePanelIdRef.current = nextPanelId;
        setActivePanelId(nextPanelId);
        await sleep(frameMs);
        if (!mountedRef.current) {
          break;
        }
      }

      setPhase("opening");
      await sleep(openMs);
      if (!mountedRef.current) {
        break;
      }
      setPhase("open");
    }

    runningRef.current = false;
    if (mountedRef.current && latestRequestRef.current) {
      void runQueue();
    }
  }, [closeMs, frameMs, openMs, setPhase, sleep]);

  const requestPanel = useCallback(
    (panelId: string) => {
      setSelectedPanelId(panelId);

      if (phaseRef.current === "open" && activePanelIdRef.current === panelId && !runningRef.current) {
        return;
      }

      latestRequestRef.current = panelId;
      void runQueue();
    },
    [runQueue]
  );

  return {
    phase,
    activePanelId,
    selectedPanelId,
    requestPanel,
    isAnimating: phase === "opening" || phase === "closing",
    isOpen: phase === "open"
  };
}
