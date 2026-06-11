import { Radio } from "lucide-react";

export function ScenarioBanner({ mock }: { mock: boolean }) {
  return (
    <div className="relative z-10 flex items-center gap-2.5 px-4 py-1.5 text-[11px] overflow-hidden rounded-xl glass">
      <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-signal-crit/12 border border-signal-crit/25 text-signal-crit font-semibold tracking-wider mono">
        <Radio className="w-3 h-3" />
        {mock ? "DEMO" : "LIVE"}
      </span>
      <span className="text-white/55">
        2026 World Cup - Round of 16 - match-day traffic surge on the
      </span>
      <span className="mono text-pitch/80">worldcup-fan-gateway</span>
      <span className="ml-auto hidden md:inline text-white/30 mono">
        Keeper protecting tickets · stream · score
      </span>
    </div>
  );
}
