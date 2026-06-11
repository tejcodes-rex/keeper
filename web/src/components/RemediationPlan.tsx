import { Check, ClipboardList, Loader2, ShieldCheck, X, XCircle } from "lucide-react";
import type { PlanData, RemediationData } from "../types";

const RISK_META: Record<string, { label: string; cls: string }> = {
  low: { label: "Low risk", cls: "text-pitch border-pitch/30 bg-pitch/8" },
  medium: { label: "Medium risk", cls: "text-signal-warn border-signal-warn/30 bg-signal-warn/8" },
  high: { label: "High risk", cls: "text-signal-crit border-signal-crit/30 bg-signal-crit/8" },
};

export function RemediationPlan({
  plan,
  awaiting,
  decision,
  remediation,
  onApprove,
  onReject,
}: {
  plan: PlanData;
  awaiting: boolean;
  decision: "approve" | "reject" | null;
  remediation: RemediationData | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const risk = RISK_META[plan.risk];

  return (
    <section
      className={`glass rounded-2xl p-5 transition-shadow duration-500 ${
        awaiting ? "shadow-pitch border border-pitch/30" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-pitch" />
        <h2 className="text-sm font-semibold tracking-wide">Remediation Plan</h2>
        <span
          className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold border ${risk.cls}`}
        >
          {risk.label}
        </span>
      </div>

      <h3 className="text-[13px] font-medium text-white/85 mb-1 leading-snug">
        {plan.title}
      </h3>
      <div className="mono text-[10px] text-white/35 mb-3">
        {plan.id} · predicted recovery ~{plan.predicted_recovery_s}s
      </div>

      <ol className="space-y-1.5 mb-4">
        {plan.steps.map((step, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-[12px] text-white/65"
          >
            <span className="grid place-items-center shrink-0 w-4 h-4 mt-0.5 rounded-full bg-white/8 mono text-[9px] text-white/50">
              {i + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      {/* Live remediation status, shown once the Operator acts. */}
      {remediation && (
        <div
          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-4 border ${
            remediation.status === "done"
              ? "bg-pitch/8 border-pitch/25"
              : remediation.status === "failed"
                ? "bg-signal-crit/8 border-signal-crit/25"
                : "bg-signal-warn/8 border-signal-warn/25"
          }`}
        >
          {remediation.status === "running" && (
            <Loader2 className="w-4 h-4 text-signal-warn animate-spin shrink-0" />
          )}
          {remediation.status === "done" && (
            <ShieldCheck className="w-4 h-4 text-pitch shrink-0" />
          )}
          {remediation.status === "failed" && (
            <XCircle className="w-4 h-4 text-signal-crit shrink-0" />
          )}
          <div className="min-w-0">
            <div className="text-[12px] font-medium text-white/85">
              {remediation.action}
            </div>
            <div className="text-[11px] text-white/50 leading-snug">
              {remediation.detail}
            </div>
          </div>
        </div>
      )}

      {/* The human gate. Weighty, prominent approve / reject controls. */}
      {awaiting && (
        <div className="animate-fade-up">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-signal-warn/8 border border-signal-warn/25 mb-3">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-signal-warn opacity-70 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-signal-warn" />
            </span>
            <span className="text-[11px] font-medium text-signal-warn tracking-wide">
              Human approval required - Keeper is holding
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2.5">
            <button
              onClick={onApprove}
              className="group relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-pitch text-ink-900 font-semibold text-sm shadow-pitch hover:brightness-110 active:scale-[0.98] transition-all"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
              Approve rollback
            </button>
            <button
              onClick={onReject}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/[0.04] border border-signal-crit/30 text-signal-crit font-semibold text-sm hover:bg-signal-crit/10 active:scale-[0.98] transition-all"
            >
              <X className="w-4 h-4" strokeWidth={3} />
              Reject
            </button>
          </div>
        </div>
      )}

      {/* Post-decision acknowledgement. */}
      {!awaiting && decision === "approve" && !remediation && (
        <div className="flex items-center gap-2 text-[12px] text-pitch">
          <Check className="w-4 h-4" strokeWidth={3} />
          Approved. Operator is executing the rollback.
        </div>
      )}
      {!awaiting && decision === "reject" && (
        <div className="flex items-center gap-2 text-[12px] text-signal-crit">
          <X className="w-4 h-4" strokeWidth={3} />
          Rejected. Run halted, no change executed.
        </div>
      )}
    </section>
  );
}
