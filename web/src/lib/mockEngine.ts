import type { KeeperEvent } from "../types";

// The mock engine replays a cinematic, World Cup themed incident on timers.
// It emits the exact same event objects the real backend would over SSE, so the
// rest of the UI does not know whether it is wired to a mock or the live agent.
//
// Flow: detect -> incident -> diagnose -> rootcause -> impact -> plan ->
// awaiting_approval -> [PAUSE for human] -> remediation -> verify ->
// postmortem -> done. Total runtime once approved is roughly 60-90 seconds.

const PLAN_ID = "plan-rb-9f31";

type Beat = { at: number; event: KeeperEvent };

const POSTMORTEM_MD = `# Postmortem: worldcup-fan-gateway latency surge (INC-2026-0614)

**Status:** Resolved  ·  **Severity:** Critical  ·  **Duration:** 4m 18s

## Summary
At kickoff of the Round of 16 match, traffic to the fan gateway surged past
1.2M requests per minute. Deploy **v2.4.0** shipped a connection-pool change
that starved the ticket and stream paths under load. p95 latency climbed from a
70 ms baseline to 1,300 ms and the error rate reached 26%. Keeper detected the
regression, tied it to the deploy, quantified the business impact, and rolled
back to **v2.3.9** after human approval. Service recovered to baseline.

## Timeline
- **20:00:07** Sentinel opens INC-2026-0614 - p95 breaches threshold (1,300 ms).
- **20:00:41** Diagnostician correlates the spike to deploy v2.4.0 (98% confidence).
- **20:01:09** Strategist quantifies impact and proposes rollback to v2.3.9.
- **20:01:30** Human approves the rollback in Mission Control.
- **20:03:55** Operator completes rollback; Verifier confirms recovery.
- **20:04:25** Scribe files this postmortem.

## Root cause
Deploy **v2.4.0** reduced the upstream HTTP connection-pool ceiling from 512 to
64 while raising the per-request keep-alive window. Under match-day concurrency
the pool saturated, requests queued, and the gateway shed load as 5xx errors.

## Action taken
Rollback to last-known-good **v2.3.9** via the gateway admin rollback endpoint.
No data loss. Action posted to Dynatrace as an event and to the on-call Slack.

## Impact
- Peak fans affected: ~412,000
- Revenue at risk: ~$58,000 / min  ·  Estimated loss: ~$249,000
- SLO error budget burned: 31%

## Prevention
1. Gate connection-pool config behind a load-tested flag, not a deploy.
2. Add a synthetic kickoff load test to the release pipeline.
3. Auto-rollback rule when p95 exceeds 5x baseline for 60s.
`;

// Pre-approval beats run automatically on a timeline (epoch from run start).
function preApprovalBeats(now: number): Beat[] {
  const t = (sec: number) => now + sec * 1000;
  return [
    { at: t(0.2), event: { type: "phase", phase: "detect", ts: t(0.2) } },
    {
      at: t(0.4),
      event: {
        type: "log",
        agent: "Sentinel",
        level: "info",
        message: "Watching worldcup-fan-gateway. Baseline p95 71 ms, error rate 0.3%.",
        ts: t(0.4),
      },
    },
    {
      at: t(2.0),
      event: {
        type: "log",
        agent: "Sentinel",
        level: "info",
        message: "Kickoff traffic surge detected: 1.24M req/min across /tickets /stream /score.",
        ts: t(2.0),
      },
    },
    {
      at: t(3.6),
      event: {
        type: "log",
        agent: "Sentinel",
        level: "warn",
        message: "DQL window: p95 climbing fast - 71 -> 340 -> 910 ms in 18s.",
        ts: t(3.6),
      },
    },
    {
      at: t(5.0),
      event: {
        type: "log",
        agent: "Sentinel",
        level: "act",
        message: "Threshold breached. Opening incident and waking the team.",
        ts: t(5.0),
      },
    },
    {
      at: t(5.6),
      event: {
        type: "incident",
        data: {
          id: "INC-2026-0614",
          title: "p95 latency surge on worldcup-fan-gateway",
          service: "worldcup-fan-gateway",
          metric: "p95_latency",
          p95_ms: 1300,
          error_rate: 0.26,
          baseline_ms: 70,
          severity: "critical",
        },
      },
    },
    { at: t(7.0), event: { type: "phase", phase: "diagnose", ts: t(7.0) } },
    {
      at: t(7.4),
      event: {
        type: "log",
        agent: "Diagnostician",
        level: "info",
        message: "Pulling change timeline and failing spans from Grail.",
        ts: t(7.4),
      },
    },
    {
      at: t(9.2),
      event: {
        type: "log",
        agent: "Diagnostician",
        level: "info",
        message: "Found deploy event v2.4.0 shipped 6s before the first breach.",
        ts: t(9.2),
      },
    },
    {
      at: t(11.0),
      event: {
        type: "log",
        agent: "Diagnostician",
        level: "info",
        message: "Davis CoPilot correlates 5xx spike to upstream connection-pool saturation.",
        ts: t(11.0),
      },
    },
    {
      at: t(12.6),
      event: {
        type: "log",
        agent: "Diagnostician",
        level: "act",
        message: "Root cause ranked: deploy v2.4.0, confidence 98%.",
        ts: t(12.6),
      },
    },
    {
      at: t(13.2),
      event: {
        type: "rootcause",
        data: {
          summary:
            "Deploy v2.4.0 cut the upstream connection-pool ceiling from 512 to 64 while widening keep-alive. Under kickoff concurrency the pool saturated, requests queued, and the gateway shed load as 5xx.",
          change: "deploy v2.4.0 (worldcup-fan-gateway)",
          evidence: [
            "Change event v2.4.0 timestamped 6s before first p95 breach",
            "Span analysis: 94% of slow requests blocked on upstream connect",
            "Pool config delta: max_connections 512 -> 64",
            "5xx concentrated on /tickets and /stream, not /score",
          ],
          confidence: 0.98,
        },
      },
    },
    { at: t(15.0), event: { type: "phase", phase: "strategize", ts: t(15.0) } },
    {
      at: t(15.4),
      event: {
        type: "log",
        agent: "Strategist",
        level: "info",
        message: "Measuring live business impact across the fan gateway.",
        ts: t(15.4),
      },
    },
    {
      at: t(16.4),
      event: {
        type: "impact",
        data: {
          fans_affected: 412000,
          revenue_per_min: 58000,
          est_total_loss: 92000,
          slo_burn_pct: 18,
        },
      },
    },
    {
      at: t(18.0),
      event: {
        type: "log",
        agent: "Strategist",
        level: "warn",
        message: "Error budget burning at 18% and climbing. Recommending immediate rollback.",
        ts: t(18.0),
      },
    },
    {
      at: t(19.4),
      event: {
        type: "log",
        agent: "Strategist",
        level: "act",
        message: "Plan ready: rollback v2.4.0 -> v2.3.9. Predicted recovery 150s. Holding for approval.",
        ts: t(19.4),
      },
    },
    {
      at: t(20.0),
      event: {
        type: "plan",
        data: {
          id: PLAN_ID,
          title: "Roll back worldcup-fan-gateway to last-known-good v2.3.9",
          steps: [
            "Freeze further deploys to the fan gateway",
            "Roll back v2.4.0 to v2.3.9 via admin rollback",
            "Restore connection-pool ceiling to 512",
            "Post action to Dynatrace event stream and on-call Slack",
            "Re-query Grail to confirm p95 and error rate recover",
          ],
          risk: "low",
          predicted_recovery_s: 150,
          requires_approval: true,
        },
      },
    },
    { at: t(20.6), event: { type: "phase", phase: "await_approval", ts: t(20.6) } },
    { at: t(20.8), event: { type: "awaiting_approval", plan_id: PLAN_ID } },
    {
      at: t(21.0),
      event: {
        type: "log",
        agent: "Strategist",
        level: "warn",
        message: "Awaiting human approval. Keeper will not act on its own.",
        ts: t(21.0),
      },
    },
  ];
}

// Impact keeps ticking while the human decides, so the meters feel alive.
function impactTick(now: number, seconds: number): Beat {
  const fans = Math.round(412000 + seconds * 5200);
  const loss = Math.round(92000 + (58000 / 60) * seconds);
  const burn = Math.min(48, 18 + seconds * 0.55);
  return {
    at: now,
    event: {
      type: "impact",
      data: {
        fans_affected: fans,
        revenue_per_min: 58000,
        est_total_loss: loss,
        slo_burn_pct: Number(burn.toFixed(1)),
      },
    },
  };
}

// Post-approval beats run after the human clicks Approve.
function postApprovalBeats(now: number): Beat[] {
  const t = (sec: number) => now + sec * 1000;
  return [
    { at: t(0.1), event: { type: "phase", phase: "remediate", ts: t(0.1) } },
    {
      at: t(0.4),
      event: {
        type: "log",
        agent: "Operator",
        level: "act",
        message: "Approval received. Freezing deploys and starting rollback.",
        ts: t(0.4),
      },
    },
    {
      at: t(1.0),
      event: {
        type: "remediation",
        data: {
          action: "Rollback v2.4.0 -> v2.3.9",
          status: "running",
          detail: "Draining v2.4.0 instances and routing to last-known-good.",
        },
      },
    },
    {
      at: t(3.0),
      event: {
        type: "log",
        agent: "Operator",
        level: "info",
        message: "Connection-pool ceiling restored to 512. Traffic shifting to v2.3.9.",
        ts: t(3.0),
      },
    },
    {
      at: t(5.0),
      event: {
        type: "log",
        agent: "Operator",
        level: "info",
        message: "Posted action to Dynatrace events and #worldcup-oncall on Slack.",
        ts: t(5.0),
      },
    },
    {
      at: t(7.0),
      event: {
        type: "remediation",
        data: {
          action: "Rollback v2.4.0 -> v2.3.9",
          status: "done",
          detail: "v2.3.9 serving 100% of fan-gateway traffic. Fault cleared.",
        },
      },
    },
    { at: t(8.0), event: { type: "phase", phase: "verify", ts: t(8.0) } },
    {
      at: t(8.4),
      event: {
        type: "log",
        agent: "Verifier",
        level: "info",
        message: "Re-querying Grail to confirm recovery. Watching p95 and error rate.",
        ts: t(8.4),
      },
    },
    {
      at: t(10.0),
      event: {
        type: "verify",
        data: {
          recovered: false,
          p95_ms: 540,
          error_rate: 0.09,
          checks: [
            { name: "Deploy frozen", ok: true },
            { name: "Rollback applied", ok: true },
            { name: "p95 under 200 ms", ok: false },
            { name: "Error rate under 1%", ok: false },
            { name: "Error budget stable", ok: false },
          ],
        },
      },
    },
    {
      at: t(12.0),
      event: {
        type: "log",
        agent: "Verifier",
        level: "info",
        message: "p95 falling: 540 ms and dropping. Error rate down to 9%.",
        ts: t(12.0),
      },
    },
    {
      at: t(14.5),
      event: {
        type: "verify",
        data: {
          recovered: false,
          p95_ms: 180,
          error_rate: 0.018,
          checks: [
            { name: "Deploy frozen", ok: true },
            { name: "Rollback applied", ok: true },
            { name: "p95 under 200 ms", ok: true },
            { name: "Error rate under 1%", ok: false },
            { name: "Error budget stable", ok: false },
          ],
        },
      },
    },
    {
      at: t(17.0),
      event: {
        type: "verify",
        data: {
          recovered: true,
          p95_ms: 74,
          error_rate: 0.004,
          checks: [
            { name: "Deploy frozen", ok: true },
            { name: "Rollback applied", ok: true },
            { name: "p95 under 200 ms", ok: true },
            { name: "Error rate under 1%", ok: true },
            { name: "Error budget stable", ok: true },
          ],
        },
      },
    },
    {
      at: t(17.6),
      event: {
        type: "log",
        agent: "Verifier",
        level: "act",
        message: "Recovery confirmed. p95 74 ms, error rate 0.4%. Service is healthy.",
        ts: t(17.6),
      },
    },
    { at: t(18.4), event: { type: "phase", phase: "report", ts: t(18.4) } },
    {
      at: t(18.8),
      event: {
        type: "log",
        agent: "Scribe",
        level: "info",
        message: "Writing postmortem and filing it as a Dynatrace notebook.",
        ts: t(18.8),
      },
    },
    {
      at: t(21.0),
      event: {
        type: "postmortem",
        data: {
          url: "https://abc12345.apps.dynatrace.com/ui/notebooks/inc-2026-0614",
          title: "Postmortem - worldcup-fan-gateway latency surge",
          markdown: POSTMORTEM_MD,
        },
      },
    },
    {
      at: t(21.6),
      event: {
        type: "log",
        agent: "Scribe",
        level: "act",
        message: "Postmortem filed. Incident INC-2026-0614 resolved. Goal kept clean.",
        ts: t(21.6),
      },
    },
    { at: t(22.4), event: { type: "done", outcome: "resolved" } },
  ];
}

export interface MockHandle {
  approve: () => void;
  reject: () => void;
  stop: () => void;
}

// Starts the mock run. `emit` receives each event; `approve` resumes the
// post-approval timeline. Returns a handle for control and teardown.
export function startMockRun(emit: (e: KeeperEvent) => void): MockHandle {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let approvalTickTimer: ReturnType<typeof setInterval> | null = null;
  let resolved = false;

  const schedule = (beat: Beat) => {
    const delay = Math.max(0, beat.at - Date.now());
    timers.push(setTimeout(() => emit(beat.event), delay));
  };

  const start = Date.now();
  preApprovalBeats(start).forEach(schedule);

  // Once awaiting approval, tick the impact meter every 2s until decided.
  const awaitingAt = start + 21000;
  timers.push(
    setTimeout(() => {
      let seconds = 0;
      approvalTickTimer = setInterval(() => {
        seconds += 2;
        if (seconds > 40) return;
        emit(impactTick(Date.now(), seconds).event);
      }, 2000);
    }, Math.max(0, awaitingAt - Date.now()))
  );

  const clearAll = () => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    if (approvalTickTimer) clearInterval(approvalTickTimer);
    approvalTickTimer = null;
  };

  return {
    approve: () => {
      if (resolved) return;
      resolved = true;
      if (approvalTickTimer) clearInterval(approvalTickTimer);
      approvalTickTimer = null;
      postApprovalBeats(Date.now()).forEach(schedule);
    },
    reject: () => {
      if (resolved) return;
      resolved = true;
      clearAll();
      emit({
        type: "log",
        agent: "Operator",
        level: "warn",
        message: "Rejected by human. Run halted. No change executed.",
        ts: Date.now(),
      });
      emit({ type: "done", outcome: "escalated" });
    },
    stop: clearAll,
  };
}
