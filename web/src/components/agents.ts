import type { AgentName } from "../types";

// Visual identity per agent: accent color, initial, and role label.
export interface AgentTheme {
  initial: string;
  color: string;
  ring: string;
  bg: string;
  role: string;
}

export const AGENTS: Record<AgentName, AgentTheme> = {
  Sentinel: {
    initial: "S",
    color: "#46d6ff",
    ring: "rgba(70,214,255,0.5)",
    bg: "rgba(70,214,255,0.12)",
    role: "Watcher",
  },
  Diagnostician: {
    initial: "D",
    color: "#a78bfa",
    ring: "rgba(167,139,250,0.5)",
    bg: "rgba(167,139,250,0.12)",
    role: "Root cause",
  },
  Strategist: {
    initial: "T",
    color: "#ffb023",
    ring: "rgba(255,176,35,0.5)",
    bg: "rgba(255,176,35,0.12)",
    role: "Planner",
  },
  Operator: {
    initial: "O",
    color: "#2be07a",
    ring: "rgba(43,224,122,0.5)",
    bg: "rgba(43,224,122,0.12)",
    role: "Actuator",
  },
  Verifier: {
    initial: "V",
    color: "#5cffa6",
    ring: "rgba(92,255,166,0.5)",
    bg: "rgba(92,255,166,0.12)",
    role: "Confirms",
  },
  Scribe: {
    initial: "C",
    color: "#ff7eb6",
    ring: "rgba(255,126,182,0.5)",
    bg: "rgba(255,126,182,0.12)",
    role: "Documents",
  },
};
