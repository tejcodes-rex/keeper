import { Check } from "lucide-react";
import type { PhaseName } from "../types";

const LABELS: Record<PhaseName, string> = {
  detect: "Detect",
  diagnose: "Diagnose",
  strategize: "Strategize",
  await_approval: "Approve",
  remediate: "Remediate",
  verify: "Verify",
  report: "Report",
};

export function PhaseStepper({
  order,
  active,
  completed,
}: {
  order: PhaseName[];
  active: PhaseName | null;
  completed: PhaseName[];
}) {
  return (
    <div className="relative z-10 glass rounded-2xl px-4 py-3">
      <ol className="flex items-center gap-1 sm:gap-2 overflow-x-auto scroll-thin">
        {order.map((phase, i) => {
          const isDone = completed.includes(phase);
          const isActive = active === phase;
          const isApprove = phase === "await_approval";
          return (
            <li key={phase} className="flex items-center gap-1 sm:gap-2 shrink-0">
              <div
                className={[
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all duration-500",
                  isActive
                    ? isApprove
                      ? "border-signal-warn/50 bg-signal-warn/10 shadow-[0_0_24px_-8px_rgba(255,176,35,0.6)]"
                      : "border-pitch/50 bg-pitch/10 shadow-[0_0_24px_-8px_rgba(43,224,122,0.6)]"
                    : isDone
                      ? "border-pitch/25 bg-pitch/[0.06]"
                      : "border-white/8 bg-white/[0.02]",
                ].join(" ")}
              >
                <span
                  className={[
                    "grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold mono transition-colors",
                    isDone
                      ? "bg-pitch text-ink-900"
                      : isActive
                        ? isApprove
                          ? "bg-signal-warn text-ink-900 animate-pulse"
                          : "bg-pitch text-ink-900 animate-pulse"
                        : "bg-white/8 text-white/40",
                  ].join(" ")}
                >
                  {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={[
                    "text-xs font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? isApprove
                        ? "text-signal-warn"
                        : "text-pitch"
                      : isDone
                        ? "text-white/70"
                        : "text-white/35",
                  ].join(" ")}
                >
                  {LABELS[phase]}
                </span>
              </div>
              {i < order.length - 1 && (
                <span
                  className={[
                    "h-px w-3 sm:w-6 transition-colors duration-500",
                    isDone ? "bg-pitch/40" : "bg-white/8",
                  ].join(" ")}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
