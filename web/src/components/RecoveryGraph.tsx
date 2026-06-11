import { useMemo } from "react";
import { LineChart } from "lucide-react";
import type { LatencyPoint } from "../hooks/useKeeperRun";
import { formatMs } from "../lib/format";

// The money shot: an SVG p95-latency trace showing baseline, the spike, and the
// drop back to healthy after remediation. Drawn from the live latency series.
export function RecoveryGraph({
  points,
  baseline,
  recovered,
}: {
  points: LatencyPoint[];
  baseline: number | null;
  recovered: boolean;
}) {
  const W = 720;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 20, left: 40 };

  const { path, area, dots, maxY, peak, latest, ticks } = useMemo(() => {
    if (points.length < 2) {
      return {
        path: "",
        area: "",
        dots: [] as { x: number; y: number; p: LatencyPoint }[],
        maxY: 1,
        peak: null as LatencyPoint | null,
        latest: null as LatencyPoint | null,
        ticks: [] as { y: number; v: number }[],
      };
    }
    const xs = points.map((p) => p.t);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const maxVal = Math.max(...points.map((p) => p.p95), baseline ?? 0) * 1.12;

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const sx = (t: number) =>
      PAD.left + ((t - minX) / Math.max(1, maxX - minX)) * innerW;
    const sy = (v: number) => PAD.top + innerH - (v / maxVal) * innerH;

    const coords = points.map((p) => ({ x: sx(p.t), y: sy(p.p95), p }));
    const d = coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(" ");
    const a =
      `M ${coords[0].x.toFixed(1)} ${(H - PAD.bottom).toFixed(1)} ` +
      coords.map((c) => `L ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ") +
      ` L ${coords[coords.length - 1].x.toFixed(1)} ${(H - PAD.bottom).toFixed(1)} Z`;

    const peakPoint = points.reduce((a2, b) => (b.p95 > a2.p95 ? b : a2), points[0]);
    const tickVals = [0, 0.5, 1].map((f) => ({
      y: sy(maxVal * f),
      v: Math.round(maxVal * f),
    }));

    return {
      path: d,
      area: a,
      dots: coords,
      maxY: maxVal,
      peak: peakPoint,
      latest: points[points.length - 1],
      ticks: tickVals,
    };
  }, [points, baseline]);

  const innerW = W - PAD.left - PAD.right;
  const baselineY =
    baseline != null && maxY > 0
      ? PAD.top + (H - PAD.top - PAD.bottom) - (baseline / maxY) * (H - PAD.top - PAD.bottom)
      : null;

  const peakX = peak && points.length > 1
    ? PAD.left +
      ((peak.t - points[0].t) / Math.max(1, points[points.length - 1].t - points[0].t)) *
        innerW
    : 0;

  return (
    <section className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-pitch" />
          <h2 className="text-sm font-semibold tracking-wide">
            Recovery Graph
          </h2>
          <span className="mono text-[10px] text-white/35">p95 latency</span>
        </div>
        {latest && (
          <div className="flex items-center gap-3 text-[11px]">
            {baseline != null && (
              <span className="flex items-center gap-1.5 text-white/40">
                <span className="w-3 h-px bg-white/30 border-t border-dashed border-white/40" />
                baseline {formatMs(baseline)}
              </span>
            )}
            <span
              className={`mono font-semibold ${
                recovered ? "text-pitch" : "text-signal-crit"
              }`}
            >
              now {formatMs(latest.p95)}
            </span>
          </div>
        )}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-[220px]"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="recArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4d5e" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#ffb023" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#2be07a" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id="recLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#46d6ff" />
            <stop offset="45%" stopColor="#ff4d5e" />
            <stop offset="78%" stopColor="#ffb023" />
            <stop offset="100%" stopColor="#2be07a" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={t.y}
              y2={t.y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={t.y + 3}
              textAnchor="end"
              className="mono"
              fontSize="9"
              fill="rgba(255,255,255,0.3)"
            >
              {t.v}
            </text>
          </g>
        ))}

        {baselineY != null && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={baselineY}
            y2={baselineY}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {area && <path d={area} fill="url(#recArea)" />}
        {path && (
          <path
            d={path}
            fill="none"
            stroke="url(#recLine)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              filter: "drop-shadow(0 0 6px rgba(255,77,94,0.3))",
            }}
          />
        )}

        {peak && peak.p95 > (baseline ?? 0) * 3 && (
          <g>
            <circle
              cx={peakX}
              cy={
                PAD.top +
                (H - PAD.top - PAD.bottom) -
                (peak.p95 / maxY) * (H - PAD.top - PAD.bottom)
              }
              r="4"
              fill="#ff4d5e"
            />
            <text
              x={peakX}
              y={
                PAD.top +
                (H - PAD.top - PAD.bottom) -
                (peak.p95 / maxY) * (H - PAD.top - PAD.bottom) -
                10
              }
              textAnchor="middle"
              className="mono"
              fontSize="10"
              fill="#ff4d5e"
              fontWeight="600"
            >
              peak {Math.round(peak.p95)}
            </text>
          </g>
        )}

        {latest && dots.length > 0 && (
          <g>
            <circle
              cx={dots[dots.length - 1].x}
              cy={dots[dots.length - 1].y}
              r="5"
              fill={recovered ? "#2be07a" : "#ff4d5e"}
            >
              <animate
                attributeName="r"
                values="5;8;5"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </circle>
            <circle
              cx={dots[dots.length - 1].x}
              cy={dots[dots.length - 1].y}
              r="3"
              fill="#05070a"
            />
          </g>
        )}
      </svg>
    </section>
  );
}
