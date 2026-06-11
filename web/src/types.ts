// Types mirror the SSE event contract defined in docs/ARCHITECTURE.md.

export type PhaseName =
  | "detect"
  | "diagnose"
  | "strategize"
  | "await_approval"
  | "remediate"
  | "verify"
  | "report";

export type AgentName =
  | "Sentinel"
  | "Diagnostician"
  | "Strategist"
  | "Operator"
  | "Verifier"
  | "Scribe";

export type LogLevel = "info" | "warn" | "act";
export type Severity = "high" | "critical";
export type Risk = "low" | "medium" | "high";
export type RemediationStatus = "running" | "done" | "failed";
export type Outcome = "resolved" | "rolled_back" | "escalated";

export interface IncidentData {
  id: string;
  title: string;
  service: string;
  metric: string;
  p95_ms: number;
  error_rate: number;
  baseline_ms: number;
  severity: Severity;
}

export interface RootcauseData {
  summary: string;
  change: string;
  evidence: string[];
  confidence: number;
}

export interface ImpactData {
  fans_affected: number;
  revenue_per_min: number;
  est_total_loss: number;
  slo_burn_pct: number;
}

export interface PlanData {
  id: string;
  title: string;
  steps: string[];
  risk: Risk;
  predicted_recovery_s: number;
  requires_approval: boolean;
}

export interface RemediationData {
  action: string;
  status: RemediationStatus;
  detail: string;
}

export interface VerifyCheck {
  name: string;
  ok: boolean;
}

export interface VerifyData {
  recovered: boolean;
  p95_ms: number;
  error_rate: number;
  checks: VerifyCheck[];
}

export interface PostmortemData {
  url: string;
  title: string;
  markdown: string;
}

// Discriminated union of every SSE envelope variant.
export type KeeperEvent =
  | { type: "phase"; phase: PhaseName; ts: number }
  | { type: "log"; agent: AgentName; level: LogLevel; message: string; ts: number }
  | { type: "incident"; data: IncidentData }
  | { type: "rootcause"; data: RootcauseData }
  | { type: "impact"; data: ImpactData }
  | { type: "plan"; data: PlanData }
  | { type: "awaiting_approval"; plan_id: string }
  | { type: "remediation"; data: RemediationData }
  | { type: "verify"; data: VerifyData }
  | { type: "postmortem"; data: PostmortemData }
  | { type: "done"; outcome: Outcome };

export type ConnectionState = "idle" | "connecting" | "live" | "reconnecting" | "closed";

export type RunStatus = "watching" | "incident" | "remediating" | "recovered" | "escalated";

// A timestamped log row for the activity feed.
export interface LogRow {
  id: number;
  agent: AgentName;
  level: LogLevel;
  message: string;
  ts: number;
}
