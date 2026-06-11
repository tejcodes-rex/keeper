"""Business impact model for a World Cup match-day fan platform.

These reference numbers turn raw reliability signals (error rate, latency) into
the language a decision maker cares about: fans affected, revenue at risk, and
error budget burned. The constants are deliberately explicit so the assumptions
are auditable rather than hidden inside a prompt.
"""

from __future__ import annotations

# Concurrent fans hitting the platform around kickoff of a marquee match.
CONCURRENT_FANS_AT_KICKOFF = 4_200_000

# Blended revenue per minute across tickets, streaming, and merchandise.
REVENUE_PER_MIN_BASELINE_USD = 18_500.0


def compute_impact(
    error_rate: float,
    p95_ms: float,
    baseline_ms: float,
    minutes_elapsed: float = 1.0,
) -> dict:
    """Estimate live business impact of the current degradation."""
    baseline = max(baseline_ms, 1.0)
    # Fans hitting bad latency feel the pain even when requests do not error.
    latency_penalty = max(0.0, min(1.0, (p95_ms - baseline) / (baseline * 12)))
    affected_fraction = min(1.0, error_rate + latency_penalty * 0.6)

    fans_affected = int(CONCURRENT_FANS_AT_KICKOFF * affected_fraction)
    revenue_per_min = round(REVENUE_PER_MIN_BASELINE_USD * affected_fraction, 2)
    est_total_loss = round(revenue_per_min * max(minutes_elapsed, 0.0), 2)
    # A 99.9% monthly SLO leaves a thin error budget; a kickoff incident eats it fast.
    slo_burn_pct = round(min(100.0, affected_fraction * 80.0), 1)

    return {
        "fans_affected": fans_affected,
        "revenue_per_min": revenue_per_min,
        "est_total_loss": est_total_loss,
        "slo_burn_pct": slo_burn_pct,
    }
