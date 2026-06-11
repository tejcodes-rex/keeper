import { useCallback, useEffect, useRef, useState } from "react";
import { KEEPER_URL, MOCK_MODE } from "../lib/config";
import { startMockRun, type MockHandle } from "../lib/mockEngine";
import type {
  ConnectionState,
  ImpactData,
  IncidentData,
  KeeperEvent,
  LogRow,
  Outcome,
  PhaseName,
  PlanData,
  RemediationData,
  RootcauseData,
  RunStatus,
  VerifyData,
} from "../types";

// One sample of the recovery graph: p95 latency over time.
export interface LatencyPoint {
  t: number;
  p95: number;
}

export interface KeeperState {
  connection: ConnectionState;
  status: RunStatus;
  activePhase: PhaseName | null;
  completedPhases: PhaseName[];
  logs: LogRow[];
  incident: IncidentData | null;
  rootcause: RootcauseData | null;
  impact: ImpactData | null;
  plan: PlanData | null;
  awaitingPlanId: string | null;
  remediation: RemediationData | null;
  verify: VerifyData | null;
  postmortem: { url: string; title: string; markdown: string } | null;
  outcome: Outcome | null;
  latency: LatencyPoint[];
  started: boolean;
  decisionSent: "approve" | "reject" | null;
}

const PHASE_ORDER: PhaseName[] = [
  "detect",
  "diagnose",
  "strategize",
  "await_approval",
  "remediate",
  "verify",
  "report",
];

const INITIAL: KeeperState = {
  connection: "idle",
  status: "watching",
  activePhase: null,
  completedPhases: [],
  logs: [],
  incident: null,
  rootcause: null,
  impact: null,
  plan: null,
  awaitingPlanId: null,
  remediation: null,
  verify: null,
  postmortem: null,
  outcome: null,
  latency: [],
  started: false,
  decisionSent: null,
};

let logSeq = 0;

function statusForPhase(phase: PhaseName, outcome: Outcome | null): RunStatus {
  if (outcome === "resolved") return "recovered";
  if (outcome === "escalated" || outcome === "rolled_back") return "escalated";
  switch (phase) {
    case "detect":
      return "incident";
    case "diagnose":
    case "strategize":
    case "await_approval":
      return "incident";
    case "remediate":
    case "verify":
      return "remediating";
    case "report":
      return "remediating";
  }
}

export function useKeeperRun() {
  const [state, setState] = useState<KeeperState>(INITIAL);
  const esRef = useRef<EventSource | null>(null);
  const mockRef = useRef<MockHandle | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTsRef = useRef<number>(0);

  const reduce = useCallback((e: KeeperEvent) => {
    setState((prev) => {
      const next: KeeperState = { ...prev };
      switch (e.type) {
        case "phase": {
          const idx = PHASE_ORDER.indexOf(e.phase);
          next.completedPhases = PHASE_ORDER.slice(0, Math.max(0, idx));
          next.activePhase = e.phase;
          next.status = statusForPhase(e.phase, prev.outcome);
          break;
        }
        case "log": {
          const row: LogRow = {
            id: ++logSeq,
            agent: e.agent,
            level: e.level,
            message: e.message,
            ts: e.ts,
          };
          next.logs = [...prev.logs, row].slice(-120);
          break;
        }
        case "incident": {
          next.incident = e.data;
          next.status = "incident";
          // Seed the recovery graph: baseline run-up then the breach.
          const base = e.data.baseline_ms;
          const t0 = startTsRef.current || Date.now();
          next.latency = [
            { t: t0 - 12000, p95: base + 2 },
            { t: t0 - 9000, p95: base + 4 },
            { t: t0 - 6000, p95: base - 1 },
            { t: t0 - 3000, p95: base + 6 },
            { t: t0 - 1500, p95: base + 40 },
            { t: t0 - 800, p95: base + 260 },
            { t: t0, p95: e.data.p95_ms },
          ];
          break;
        }
        case "rootcause":
          next.rootcause = e.data;
          break;
        case "impact":
          next.impact = e.data;
          break;
        case "plan":
          next.plan = e.data;
          break;
        case "awaiting_approval":
          next.awaitingPlanId = e.plan_id;
          break;
        case "remediation": {
          next.remediation = e.data;
          next.status = "remediating";
          break;
        }
        case "verify": {
          next.verify = e.data;
          // Append the verification p95 sample to the recovery graph.
          next.latency = [...prev.latency, { t: Date.now(), p95: e.data.p95_ms }];
          if (e.data.recovered) next.status = "remediating";
          break;
        }
        case "postmortem":
          next.postmortem = e.data;
          break;
        case "done": {
          next.outcome = e.outcome;
          next.status = e.outcome === "resolved" ? "recovered" : "escalated";
          if (e.outcome === "resolved") {
            next.completedPhases = [...PHASE_ORDER];
            next.activePhase = null;
            next.awaitingPlanId = null;
          }
          break;
        }
      }
      return next;
    });
  }, []);

  const teardown = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    if (mockRef.current) {
      mockRef.current.stop();
      mockRef.current = null;
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
  }, []);

  const connectLive = useCallback(() => {
    teardown();
    setState((p) => ({ ...p, connection: "connecting" }));
    const es = new EventSource(`${KEEPER_URL}/api/stream`);
    esRef.current = es;

    es.onopen = () => setState((p) => ({ ...p, connection: "live" }));
    es.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(msg.data) as KeeperEvent;
        reduce(parsed);
      } catch {
        // Ignore malformed frames rather than tearing down the stream.
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects; reflect that state and back off our own
      // explicit retry in case the browser gives up.
      setState((p) => ({ ...p, connection: "reconnecting" }));
      if (!retryRef.current) {
        retryRef.current = setTimeout(() => {
          retryRef.current = null;
          if (esRef.current && esRef.current.readyState === EventSource.CLOSED) {
            connectLive();
          }
        }, 3000);
      }
    };
  }, [reduce, teardown]);

  const start = useCallback(async () => {
    // Reset to a clean slate so the run is re-runnable.
    teardown();
    logSeq = 0;
    startTsRef.current = Date.now();
    setState({ ...INITIAL, started: true, connection: MOCK_MODE ? "live" : "connecting" });

    if (MOCK_MODE) {
      mockRef.current = startMockRun(reduce);
      return;
    }

    try {
      await fetch(`${KEEPER_URL}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } catch {
      // Surface as a log row but still attempt to subscribe.
      reduce({
        type: "log",
        agent: "Sentinel",
        level: "warn",
        message: "Could not reach Keeper /api/run. Retrying stream subscription.",
        ts: Date.now(),
      });
    }
    connectLive();
  }, [connectLive, reduce, teardown]);

  const decide = useCallback(
    async (decision: "approve" | "reject") => {
      const planId = state.awaitingPlanId;
      setState((p) => ({ ...p, decisionSent: decision, awaitingPlanId: null }));

      if (MOCK_MODE) {
        if (decision === "approve") mockRef.current?.approve();
        else mockRef.current?.reject();
        return;
      }
      if (!planId) return;
      try {
        await fetch(`${KEEPER_URL}/api/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_id: planId, decision }),
        });
      } catch {
        reduce({
          type: "log",
          agent: "Operator",
          level: "warn",
          message: "Failed to send decision to Keeper. Check the backend connection.",
          ts: Date.now(),
        });
      }
    },
    [reduce, state.awaitingPlanId]
  );

  useEffect(() => teardown, [teardown]);

  return {
    state,
    start,
    approve: () => decide("approve"),
    reject: () => decide("reject"),
    phaseOrder: PHASE_ORDER,
  };
}
