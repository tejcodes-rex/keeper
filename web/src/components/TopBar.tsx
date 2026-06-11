import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import type { RunStatus } from "../types";
import { formatClock } from "../lib/format";

const STATUS_META: Record<
  RunStatus,
  { label: string; dot: string; text: string; ring: string; pulse: string }
> = {
  watching: {
    label: "Watching",
    dot: "#46d6ff",
    text: "text-signal-info",
    ring: "rgba(70,214,255,0.35)",
    pulse: "animate-pulse-ring",
  },
  incident: {
    label: "Incident",
    dot: "#ff4d5e",
    text: "text-signal-crit",
    ring: "rgba(255,77,94,0.4)",
    pulse: "animate-pulse-crit",
  },
  remediating: {
    label: "Remediating",
    dot: "#ffb023",
    text: "text-signal-warn",
    ring: "rgba(255,176,35,0.4)",
    pulse: "animate-pulse-ring",
  },
  recovered: {
    label: "Recovered",
    dot: "#2be07a",
    text: "text-pitch",
    ring: "rgba(43,224,122,0.4)",
    pulse: "",
  },
  escalated: {
    label: "Escalated",
    dot: "#ff4d5e",
    text: "text-signal-crit",
    ring: "rgba(255,77,94,0.4)",
    pulse: "animate-pulse-crit",
  },
};

export function TopBar({ status }: { status: RunStatus }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const meta = STATUS_META[status];

  return (
    <header className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 border-b hairline glass">
      <div className="flex items-center gap-3">
        <div className="relative grid place-items-center w-10 h-10 rounded-xl bg-pitch/10 border border-pitch/30 shadow-pitch">
          <Shield className="w-5 h-5 text-pitch" strokeWidth={2.2} />
          <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-pitch shadow-[0_0_10px_2px_rgba(43,224,122,0.7)]" />
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-[0.14em] text-glow-pitch">
              KEEPER
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider text-pitch/80 border border-pitch/30 bg-pitch/5 mono">
              MISSION CONTROL
            </span>
          </div>
          <div className="text-[11px] text-white/45 tracking-wide">
            Autonomous Site Reliability Engineer
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div
          className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border bg-white/[0.03] ${meta.pulse}`}
          style={{ borderColor: meta.ring }}
        >
          <span
            className="relative flex w-2.5 h-2.5"
            aria-hidden
          >
            <span
              className="absolute inline-flex w-full h-full rounded-full opacity-60 animate-ping"
              style={{ backgroundColor: meta.dot }}
            />
            <span
              className="relative inline-flex w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: meta.dot }}
            />
          </span>
          <span className={`text-xs font-semibold tracking-wide ${meta.text}`}>
            {meta.label}
          </span>
        </div>

        <div className="hidden sm:flex flex-col items-end leading-tight">
          <span className="mono text-base font-medium text-white/85">
            {formatClock(now)}
          </span>
          <span className="text-[10px] text-white/35 tracking-wider uppercase">
            Match clock UTC
          </span>
        </div>
      </div>
    </header>
  );
}
