import { GitCommit, Search } from "lucide-react";
import type { RootcauseData } from "../types";

export function RootCausePanel({ data }: { data: RootcauseData }) {
  const confPct = Math.round(data.confidence * 100);
  return (
    <section className="glass rounded-2xl p-5 animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-[#a78bfa]" />
        <h2 className="text-sm font-semibold tracking-wide">Root Cause</h2>
      </div>

      <p className="text-[13px] leading-relaxed text-white/75 mb-4">
        {data.summary}
      </p>

      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-[#a78bfa]/8 border border-[#a78bfa]/25">
        <GitCommit className="w-4 h-4 text-[#a78bfa] shrink-0" />
        <span className="text-[11px] uppercase tracking-wider text-white/40">
          Offending change
        </span>
        <span className="mono text-sm font-semibold text-[#c4b5fd] ml-auto">
          {data.change}
        </span>
      </div>

      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-wider text-white/35 mb-2">
          Evidence
        </div>
        <ul className="space-y-1.5">
          {data.evidence.map((ev, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-[12px] text-white/65 animate-slide-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="mono text-[10px] text-[#a78bfa] mt-0.5">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="leading-snug">{ev}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-white/35">
            Confidence
          </span>
          <span className="mono text-sm font-semibold text-[#c4b5fd]">
            {confPct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#7c5cff] to-[#a78bfa] transition-all duration-1000 ease-out"
            style={{
              width: `${confPct}%`,
              boxShadow: "0 0 12px rgba(167,139,250,0.5)",
            }}
          />
        </div>
      </div>
    </section>
  );
}
