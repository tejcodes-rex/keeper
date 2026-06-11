import { Users, DollarSign, Flame } from "lucide-react";
import type { ImpactData } from "../types";
import { useCountUp } from "../hooks/useCountUp";
import { formatInt, formatMoney } from "../lib/format";

export function ImpactMeter({ data }: { data: ImpactData }) {
  const fans = useCountUp(data.fans_affected);
  const loss = useCountUp(data.est_total_loss);
  const burn = useCountUp(data.slo_burn_pct, 700);

  return (
    <section className="glass rounded-2xl p-5 border border-signal-warn/20">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-signal-warn" />
        <h2 className="text-sm font-semibold tracking-wide">Business Impact</h2>
        <span className="ml-auto mono text-[10px] text-signal-crit animate-pulse">
          LIVE
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.025] border border-white/8">
          <div className="grid place-items-center w-9 h-9 rounded-lg bg-signal-info/12 border border-signal-info/25 text-signal-info">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-white/35">
              Fans affected
            </div>
            <div className="mono text-2xl font-semibold text-white/90 leading-tight">
              {formatInt(fans)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="px-3 py-3 rounded-xl bg-signal-crit/8 border border-signal-crit/20">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-white/35 mb-1">
              <DollarSign className="w-3 h-3 text-signal-crit" />
              Per minute
            </div>
            <div className="mono text-lg font-semibold text-signal-crit">
              {formatMoney(data.revenue_per_min)}
            </div>
          </div>
          <div className="px-3 py-3 rounded-xl bg-white/[0.025] border border-white/8">
            <div className="text-[10px] uppercase tracking-wider text-white/35 mb-1">
              At risk total
            </div>
            <div className="mono text-lg font-semibold text-white/85">
              {formatMoney(loss)}
            </div>
          </div>
        </div>

        <div className="px-3 py-3 rounded-xl bg-white/[0.025] border border-white/8">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-white/35">
              SLO error budget burn
            </span>
            <span
              className={`mono text-sm font-semibold ${
                burn > 35 ? "text-signal-crit" : "text-signal-warn"
              }`}
            >
              {burn.toFixed(1)}%
            </span>
          </div>
          <div className="relative h-2.5 rounded-full bg-pitch/15 overflow-hidden">
            {/* Remaining budget depletes from the right as burn climbs. */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-pitch/60 to-pitch transition-all duration-700"
              style={{ width: `${Math.max(0, 100 - burn)}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-signal-crit to-signal-warn/70 transition-all duration-700"
              style={{ width: `${Math.min(100, burn)}%` }}
            />
          </div>
          <div className="mono text-[10px] text-white/30 mt-1">
            {(100 - burn).toFixed(1)}% budget remaining
          </div>
        </div>
      </div>
    </section>
  );
}
