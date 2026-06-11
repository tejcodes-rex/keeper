import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";
import type { LogRow } from "../types";
import { AGENTS } from "./agents";
import { formatLogTime } from "../lib/format";

const LEVEL_TAG: Record<string, { label: string; cls: string }> = {
  info: { label: "INFO", cls: "text-white/40 border-white/10" },
  warn: { label: "WARN", cls: "text-signal-warn border-signal-warn/30 bg-signal-warn/5" },
  act: { label: "ACT", cls: "text-pitch border-pitch/30 bg-pitch/5" },
};

export function ActivityFeed({ logs }: { logs: LogRow[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs.length]);

  return (
    <section className="glass rounded-2xl flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b hairline">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-pitch" />
          <h2 className="text-sm font-semibold tracking-wide">Agent Activity</h2>
        </div>
        <span className="mono text-[10px] text-white/35">{logs.length} events</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto scroll-thin px-2.5 py-2 space-y-1.5">
        {logs.length === 0 && (
          <div className="h-full grid place-items-center text-center px-6">
            <div className="text-white/30 text-sm">
              <div className="mb-1 mono text-xs tracking-wider">STANDING BY</div>
              Start a run to watch the agent team work the incident live.
            </div>
          </div>
        )}

        {logs.map((row) => {
          const agent = AGENTS[row.agent];
          const tag = LEVEL_TAG[row.level];
          return (
            <div
              key={row.id}
              className="group flex gap-2.5 px-2 py-2 rounded-xl hover:bg-white/[0.03] animate-slide-in"
            >
              <div
                className="shrink-0 grid place-items-center w-7 h-7 rounded-lg text-[11px] font-bold mono border"
                style={{
                  color: agent.color,
                  backgroundColor: agent.bg,
                  borderColor: agent.ring,
                }}
                title={`${row.agent} - ${agent.role}`}
              >
                {agent.initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="text-xs font-semibold"
                    style={{ color: agent.color }}
                  >
                    {row.agent}
                  </span>
                  <span
                    className={`px-1 py-px rounded text-[9px] font-semibold mono border ${tag.cls}`}
                  >
                    {tag.label}
                  </span>
                  <span className="ml-auto mono text-[10px] text-white/25">
                    {formatLogTime(row.ts)}
                  </span>
                </div>
                <p className="text-[13px] leading-snug text-white/75">
                  {row.message}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </section>
  );
}
