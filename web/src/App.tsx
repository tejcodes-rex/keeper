import { useEffect, useState } from "react";
import { FileText, Wifi, WifiOff } from "lucide-react";
import { useKeeperRun } from "./hooks/useKeeperRun";
import { MOCK_MODE } from "./lib/config";
import { TopBar } from "./components/TopBar";
import { ScenarioBanner } from "./components/ScenarioBanner";
import { PhaseStepper } from "./components/PhaseStepper";
import { ActivityFeed } from "./components/ActivityFeed";
import { IncidentCard } from "./components/IncidentCard";
import { RecoveryGraph } from "./components/RecoveryGraph";
import { RootCausePanel } from "./components/RootCausePanel";
import { ImpactMeter } from "./components/ImpactMeter";
import { RemediationPlan } from "./components/RemediationPlan";
import { VerificationPanel } from "./components/VerificationPanel";
import { PostmortemModal } from "./components/PostmortemModal";
import { StartPanel } from "./components/StartPanel";

export default function App() {
  const { state, start, approve, reject, phaseOrder } = useKeeperRun();
  const [showPostmortem, setShowPostmortem] = useState(false);

  // Auto-open the postmortem when it arrives, then leave a button to reopen.
  useEffect(() => {
    if (state.postmortem) setShowPostmortem(true);
  }, [state.postmortem]);

  const finished = state.outcome !== null;
  const awaiting = state.awaitingPlanId !== null && state.decisionSent === null;

  const connLive = state.connection === "live";
  const connLabel =
    state.connection === "live"
      ? MOCK_MODE
        ? "Mock stream"
        : "Stream live"
      : state.connection === "reconnecting"
        ? "Reconnecting"
        : state.connection === "connecting"
          ? "Connecting"
          : "Offline";

  return (
    <div className="app-bg flex flex-col min-h-screen">
      <TopBar status={state.status} />

      <main className="relative z-10 flex-1 w-full max-w-[1500px] mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4 min-h-0">
        <ScenarioBanner mock={MOCK_MODE} />

        <div className="flex items-center gap-3">
          <div className="flex-1">
            <PhaseStepper
              order={phaseOrder}
              active={state.activePhase}
              completed={state.completedPhases}
            />
          </div>
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl glass mono text-[11px] ${
              connLive ? "text-pitch" : "text-white/40"
            }`}
            title={connLabel}
          >
            {connLive ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {connLabel}
          </div>
        </div>

        {/* Three-column operations grid. */}
        <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)_360px] gap-4 flex-1 min-h-0">
          {/* Left: live agent activity. */}
          <div className="min-h-0 lg:max-h-[calc(100vh-220px)] h-[480px] lg:h-auto">
            <ActivityFeed logs={state.logs} />
          </div>

          {/* Center: incident, recovery graph, root cause. */}
          <div className="flex flex-col gap-4 min-w-0">
            {!state.started || finished ? (
              <StartPanel
                started={state.started}
                finished={finished}
                onStart={start}
              />
            ) : null}

            {state.incident && <IncidentCard incident={state.incident} />}

            {state.incident && (
              <RecoveryGraph
                points={state.latency}
                baseline={state.incident.baseline_ms}
                recovered={state.verify?.recovered ?? false}
              />
            )}

            {state.rootcause && <RootCausePanel data={state.rootcause} />}

            {state.started && !state.incident && (
              <div className="glass rounded-2xl p-8 text-center text-white/40 text-sm">
                <div className="mono text-xs tracking-wider mb-1 text-pitch/70">
                  SENTINEL ACTIVE
                </div>
                Watching the fan gateway. Waiting for the first signal.
              </div>
            )}
          </div>

          {/* Right: impact, plan, verification, postmortem. */}
          <div className="flex flex-col gap-4 min-w-0">
            {state.impact && <ImpactMeter data={state.impact} />}

            {state.plan && (
              <RemediationPlan
                plan={state.plan}
                awaiting={awaiting}
                decision={state.decisionSent}
                remediation={state.remediation}
                onApprove={approve}
                onReject={reject}
              />
            )}

            {state.verify && <VerificationPanel data={state.verify} />}

            {state.postmortem && (
              <button
                onClick={() => setShowPostmortem(true)}
                className="glass rounded-2xl p-4 flex items-center gap-3 text-left hover:border-pitch/30 transition-colors group"
              >
                <div className="grid place-items-center w-10 h-10 rounded-xl bg-pitch/10 border border-pitch/25 text-pitch group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white/85">
                    Postmortem filed
                  </div>
                  <div className="text-[11px] text-white/45 truncate">
                    {state.postmortem.title}
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      </main>

      {showPostmortem && state.postmortem && (
        <PostmortemModal
          data={state.postmortem}
          onClose={() => setShowPostmortem(false)}
        />
      )}
    </div>
  );
}
