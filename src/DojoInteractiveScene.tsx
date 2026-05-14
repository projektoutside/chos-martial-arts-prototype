import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router";
import { doorSlot, dojoSceneAssets, getDojoDebugEnabled, sceneRectStyle } from "./dojoSceneAssets";
import type { DojoControlIconRenderer, DojoDoorPhase, DojoPanelData } from "./dojoSceneTypes";
import { useDojoDoorMachine } from "./useDojoDoorMachine";

interface DojoInteractiveSceneProps {
  panels: DojoPanelData[];
  renderControlIcon?: DojoControlIconRenderer;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function DojoLayerImage({ src, className, style }: { src: string; className: string; style?: CSSProperties }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={`${className} dojo-image-fallback`} style={style} aria-hidden="true"></div>;
  }

  return <img className={className} src={src} style={style} alt="" draggable={false} loading="eager" onError={() => setFailed(true)} />;
}

function DojoDataPanel({ panel }: { panel: DojoPanelData }) {
  const headingId = `dojo-panel-heading-${panel.id}`;

  return (
    <article className={`dojo-data-panel tone-${panel.tone ?? "default"}`} role="region" aria-live="polite" aria-labelledby={headingId}>
      <div className="dojo-data-paper">
        {panel.eyebrow && <p className="dojo-panel-eyebrow">{panel.eyebrow}</p>}
        <h2 id={headingId}>{panel.title}</h2>
        {panel.subtitle && <p className="dojo-panel-subtitle">{panel.subtitle}</p>}
        <p className="dojo-panel-description">{panel.description}</p>
        {panel.stats && panel.stats.length > 0 && (
          <dl className="dojo-panel-stats">
            {panel.stats.map((stat) => (
              <div key={`${panel.id}-${stat.label}`}>
                <dt>{stat.label}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {panel.sections && panel.sections.length > 0 && (
          <div className="dojo-panel-sections">
            {panel.sections.map((section) => (
              <section key={`${panel.id}-${section.heading}`}>
                <h3>{section.heading}</h3>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        )}
        {panel.cta?.href && (
          <Link className="dojo-panel-cta" to={panel.cta.href}>
            {panel.cta.label}
          </Link>
        )}
      </div>
    </article>
  );
}

function DojoSlidingDoor({ phase, style }: { phase: DojoDoorPhase; style: CSSProperties }) {
  return (
    <div className={`dojo-sliding-door-slot is-${phase}`} style={style} aria-hidden="true">
      <DojoLayerImage src={dojoSceneAssets.slidingDoor} className="dojo-sliding-door-image" />
      <span className="dojo-door-contact-shadow"></span>
    </div>
  );
}

function DojoSceneControls({
  panels,
  selectedPanelId,
  onRequestPanel,
  renderControlIcon
}: {
  panels: DojoPanelData[];
  selectedPanelId: string;
  onRequestPanel: (panelId: string) => void;
  renderControlIcon?: DojoControlIconRenderer;
}) {
  const studentPanels = panels.filter((panel) => panel.group !== "parent");
  const parentPanels = panels.filter((panel) => panel.group === "parent");

  const renderGroup = (items: DojoPanelData[], label: string) => {
    if (items.length === 0) {
      return null;
    }

    return (
      <nav className="dojo-control-group" aria-label={label}>
        {items.map((panel) => (
          <button
            className={`dojo-control-button tone-${panel.tone ?? "default"} ${selectedPanelId === panel.id ? "is-selected" : ""}`}
            key={panel.id}
            type="button"
            aria-label={`Reveal ${panel.buttonLabel}`}
            aria-pressed={selectedPanelId === panel.id}
            onClick={() => onRequestPanel(panel.id)}
          >
            <span className="dojo-control-icon" aria-hidden="true">
              {renderControlIcon?.(panel)}
            </span>
            <span>{panel.buttonLabel}</span>
          </button>
        ))}
      </nav>
    );
  };

  return (
    <div className="dojo-controls">
      {renderGroup(studentPanels, "Student actions")}
      {renderGroup(parentPanels, "Parent and account actions")}
    </div>
  );
}

export function DojoInteractiveScene({ panels, renderControlIcon }: DojoInteractiveSceneProps) {
  const firstPanelId = panels[0]?.id ?? "";
  const prefersReducedMotion = usePrefersReducedMotion();
  const door = useDojoDoorMachine({ initialPanelId: firstPanelId, reducedMotion: prefersReducedMotion });
  const activePanel = panels.find((panel) => panel.id === door.activePanelId) ?? panels[0];
  const debugEnabled = useMemo(() => getDojoDebugEnabled(), []);
  const slotStyle = sceneRectStyle(doorSlot);

  useEffect(() => {
    [dojoSceneAssets.roomBackground, dojoSceneAssets.slidingDoor, dojoSceneAssets.dataPanelFrame].forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, []);

  if (!activePanel) {
    return null;
  }

  return (
    <section className="dojo-home" aria-labelledby="dojo-home-title">
      <div className="dojo-home-heading">
        <p className="eyebrow">Cho&apos;s Martial Arts</p>
        <h1 id="dojo-home-title">Awakening Dojo</h1>
      </div>

      <div
        className={`dojo-scene-frame is-${door.phase} ${prefersReducedMotion ? "is-reduced-motion" : ""}`}
        role="region"
        aria-label="Awakening dojo sliding-door scene"
        data-phase={door.phase}
        data-selected-panel={door.selectedPanelId}
      >
        <div className="dojo-scene-canvas">
          <DojoLayerImage src={dojoSceneAssets.roomBackground} className="dojo-room-bg" />
          <div className="dojo-sunlight" aria-hidden="true"></div>
          <DojoLayerImage src={dojoSceneAssets.bonsai} className="dojo-decor dojo-bonsai" />
          <DojoLayerImage src={dojoSceneAssets.scrollValues} className="dojo-decor dojo-scroll" />
          <DojoLayerImage src={dojoSceneAssets.emptyBeltRack} className="dojo-decor dojo-rack" />

          <div className="dojo-panel-slot" style={slotStyle}>
            <DojoDataPanel panel={activePanel} />
          </div>
          <div className="dojo-cavity-shadow" style={slotStyle} aria-hidden="true"></div>
          <DojoSlidingDoor phase={door.phase} style={slotStyle} />
          <div className="dojo-track-mask dojo-track-mask-left" style={slotStyle} aria-hidden="true"></div>
          <div className="dojo-track-mask dojo-track-mask-right" style={slotStyle} aria-hidden="true"></div>

          <DojoSceneControls panels={panels} selectedPanelId={door.selectedPanelId} onRequestPanel={door.requestPanel} renderControlIcon={renderControlIcon} />

          {debugEnabled && (
            <div className="dojo-debug-overlay" aria-hidden="true">
              <div className="dojo-debug-grid"></div>
              <div className="dojo-debug-slot" style={slotStyle}></div>
              <p>
                phase: {door.phase} | selected: {door.selectedPanelId}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
