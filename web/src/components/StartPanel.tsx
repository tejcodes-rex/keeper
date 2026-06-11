import { Play, RotateCcw, Shield } from "lucide-react";

export function StartPanel({
  started,
  finished,
  onStart,
}: {
  started: boolean;
  finished: boolean;
  onStart: () => void;
}) {
  if (started && !finished) return null;

  return (
    <div className="glass rounded-2xl p-8 text-center">
      <div className="relative mx-auto mb-5 grid place-items-center w-16 h-16 rounded-2xl bg-pitch/10 border border-pitch/25 shadow-pitch animate-pulse-ring">
        <Shield className="w-8 h-8 text-pitch" strokeWidth={2} />
      </div>
      <h2 className="text-lg font-semibold text-white/90 mb-1">
        {finished ? "Run complete" : "Keeper is standing by"}
      </h2>
      <p className="text-[13px] text-white/50 max-w-sm mx-auto mb-5 leading-relaxed">
        {finished
          ? "The incident is closed. Start another run to replay the full detect, diagnose, approve, remediate, and verify loop."
          : "Start a run to watch Keeper detect the match-day regression, find the root cause, quantify the business impact, and propose a fix for you to approve."}
      </p>
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-pitch text-ink-900 font-semibold text-sm shadow-pitch hover:brightness-110 active:scale-[0.98] transition-all"
      >
        {finished ? (
          <RotateCcw className="w-4 h-4" strokeWidth={2.5} />
        ) : (
          <Play className="w-4 h-4 fill-ink-900" strokeWidth={2.5} />
        )}
        {finished ? "Run again" : "Start Run"}
      </button>
    </div>
  );
}
