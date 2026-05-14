import type { ReactNode } from "react";

export type DojoDoorPhase = "closed" | "opening" | "open" | "closing";

export interface DojoPanelSection {
  heading: string;
  body: string;
}

export interface DojoPanelStat {
  label: string;
  value: string;
}

export interface DojoPanelData {
  id: string;
  buttonLabel: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  description: string;
  sections?: DojoPanelSection[];
  stats?: DojoPanelStat[];
  cta?: {
    label: string;
    href?: string;
    action?: string;
  };
  tone?: string;
  group?: "student" | "parent";
}

export type DojoControlIconRenderer = (panel: DojoPanelData) => ReactNode;
