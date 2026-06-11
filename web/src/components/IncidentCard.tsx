import { AlertTriangle, Server } from "lucide-react";
import type { IncidentData } from "../types";
import { formatMs, formatPct } from "../lib/format";

export function IncidentCard({ incident }: { incident: IncidentData }) {
  const isCrit = incident.severity === "critical";
  const ratio = incident.p95_ms / Math.max(1, incident.baseline_ms);

  return (
    <section
      className={`glass rounded-2xl p-5 animate-fade-up border ${
        isCrit ? "border-signal-crit/30 shadow-crit" : "border-signal-warn/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <div
            className={`grid place-items-center w-10 h-10 rounded-xl border ${
              isCrit
                ? "bg-signal-crit/10 border-signal-crit/30 text-signal-crit"
                : "bg-signal-warn/10 border-signal-warn/30 text-signal-warn"
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="mono text-[11px] text-white/40">{incident.id}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                  isCrit
                    ? "bg-signal-crit/15 text-signal-crit border border-signal-crit/30"
                    : "bg-signal-warn/15 text-signal-warn border border-signal-warn/30"
                }`}
              >
                {incident.severity}
              </span>
            </div>
            <h2 className="text-base font-semibold text-white/90 leading-snug">
              {incident.title}
            </h2>
            <div className="flex items-center gap-1.5 mt-1 text-white/45 text-xs">
              <Server className="w-3.5 h-3.5" />
              <span className="mono">{incident.service}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric
          label="p95 latency"
          value={formatMs(incident.p95_ms)}
          sub={`baseline ${formatMs(incident.baseline_ms)}`}
          tone="crit"
        />
        <Metric
          label="vs baseline"
          value={`${ratio.toFixed(1)}x`}
          sub="over normal"
          tone="warn"
        />
        <Metric
          label="error rate"
          value={formatPct(incident.error_rate * 100, 0)}
          sub={incident.metric}
          tone="crit"
        />
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "crit" | "warn";
}) {
  const color = tone === "crit" ? "text-signal-crit" : "text-signal-warn";
  return (
    <div className="rounded-xl bg-white/[0.025] border border-white/8 p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1">
        {label}
      </div>
      <div className={`mono text-xl font-semibold ${color}`}>{value}</div>
      <div className="mono text-[10px] text-white/30 mt-0.5">{sub}</div>
    </div>
  );
}
