import { BadgeCheck, Check, CircleDashed } from "lucide-react";
import type { VerifyData } from "../types";
import { formatMs, formatPct } from "../lib/format";

export function VerificationPanel({ data }: { data: VerifyData }) {
  return (
    <section className="glass rounded-2xl p-5 relative overflow-hidden animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <BadgeCheck className="w-4 h-4 text-pitch" />
        <h2 className="text-sm font-semibold tracking-wide">Verification</h2>
        <div className="ml-auto flex items-center gap-2 mono text-[11px]">
          <span className={data.p95_ms < 200 ? "text-pitch" : "text-signal-warn"}>
            p95 {formatMs(data.p95_ms)}
          </span>
          <span className="text-white/20">·</span>
          <span
            className={data.error_rate < 0.01 ? "text-pitch" : "text-signal-warn"}
          >
            err {formatPct(data.error_rate * 100, 1)}
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {data.checks.map((c, i) => (
          <li
            key={c.name}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/6 transition-colors"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span
              className={`grid place-items-center w-5 h-5 rounded-full transition-all duration-500 ${
                c.ok
                  ? "bg-pitch text-ink-900"
                  : "bg-white/8 text-white/40"
              }`}
            >
              {c.ok ? (
                <Check className="w-3 h-3" strokeWidth={3} />
              ) : (
                <CircleDashed className="w-3 h-3 animate-spin" />
              )}
            </span>
            <span
              className={`text-[12px] ${
                c.ok ? "text-white/80" : "text-white/45"
              }`}
            >
              {c.name}
            </span>
            <span
              className={`ml-auto mono text-[10px] ${
                c.ok ? "text-pitch" : "text-white/30"
              }`}
            >
              {c.ok ? "PASS" : "..."}
            </span>
          </li>
        ))}
      </ul>

      {data.recovered && (
        <div className="pointer-events-none absolute top-4 right-4">
          <div
            className="px-4 py-1.5 rounded-lg border-2 border-pitch/70 text-pitch font-bold tracking-[0.2em] text-sm animate-stamp-in"
            style={{
              boxShadow: "0 0 30px -6px rgba(43,224,122,0.6)",
              textShadow: "0 0 14px rgba(43,224,122,0.6)",
            }}
          >
            RECOVERED
          </div>
        </div>
      )}
    </section>
  );
}
