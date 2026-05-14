import type { CSSProperties } from "react";

export const DESIGN_WIDTH = 1536;
export const DESIGN_HEIGHT = 1536;

export const doorSlot = {
  x: 388,
  y: 42,
  width: 820,
  height: 1482
};

const dojoAssetFiles = {
  roomBackground: "dojo-room-awakening-bg.png",
  slidingDoor: "dojo-large-center-sliding-door.png",
  logoPlaque: "dojo-logo-plaque.png",
  emptyBeltRack: "dojo-empty-belt-rack.png",
  beltWhite: "dojo-belt-white.png",
  beltYellow: "dojo-belt-yellow.png",
  beltOrange: "dojo-belt-orange.png",
  beltGreen: "dojo-belt-green.png",
  beltBlue: "dojo-belt-blue.png",
  beltPurple: "dojo-belt-purple.png",
  beltBrown: "dojo-belt-brown.png",
  beltBlack: "dojo-belt-black.png",
  scrollValues: "dojo-scroll-values.png",
  bonsai: "dojo-bonsai.png",
  woodComponents: "dojo-wood-components.png",
  dataPanelFrame: "dojo-data-panel-frame.png"
} as const;

function publicDojoAsset(fileName: string) {
  const base = import.meta.env.BASE_URL || "/";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  return `${normalizedBase}assets/dojo/${fileName}`;
}

export const dojoSceneAssets = Object.fromEntries(
  Object.entries(dojoAssetFiles).map(([key, fileName]) => [key, publicDojoAsset(fileName)])
) as Record<keyof typeof dojoAssetFiles, string>;

export function sceneRectStyle(rect: { x: number; y: number; width: number; height: number }): CSSProperties {
  return {
    left: `${(rect.x / DESIGN_WIDTH) * 100}%`,
    top: `${(rect.y / DESIGN_HEIGHT) * 100}%`,
    width: `${(rect.width / DESIGN_WIDTH) * 100}%`,
    height: `${(rect.height / DESIGN_HEIGHT) * 100}%`
  };
}

export function getDojoDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }
  const params = new URLSearchParams(window.location.search);
  return params.get("dojoDebug") === "1" || window.localStorage.getItem("dojoDebug") === "1";
}
