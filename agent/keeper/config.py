"""Runtime configuration for Keeper, read entirely from the environment."""

from __future__ import annotations

import os
from dataclasses import dataclass


def _flag(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    # Google Cloud / Vertex AI
    project: str = os.getenv("GOOGLE_CLOUD_PROJECT", "")
    location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    use_vertex: bool = _flag(os.getenv("GOOGLE_GENAI_USE_VERTEXAI", "TRUE"), True)
    model: str = os.getenv("KEEPER_MODEL", "gemini-3.1-pro-preview")

    # Dynatrace platform (read + act through MCP)
    dt_environment: str = os.getenv("DT_ENVIRONMENT", "").rstrip("/")
    dt_platform_token: str = os.getenv("DT_PLATFORM_TOKEN", "")
    dt_grail_budget_gb: str = os.getenv("DT_GRAIL_QUERY_BUDGET_GB", "10")

    # Wiring to the protected service
    victim_base_url: str = os.getenv("VICTIM_BASE_URL", "").rstrip("/")
    service_name: str = os.getenv("KEEPER_TARGET_SERVICE", "worldcup-fan-gateway")

    # Optional notifications
    slack_connection_id: str = os.getenv("DT_SLACK_CONNECTION_ID", "")
    notify_email: str = os.getenv("NOTIFY_EMAIL", "")

    # Detection thresholds
    p95_threshold_ms: float = float(os.getenv("KEEPER_P95_THRESHOLD_MS", "400"))
    error_rate_threshold: float = float(os.getenv("KEEPER_ERROR_THRESHOLD", "0.05"))

    # Demo mode replays a scripted incident with no live Dynatrace calls.
    demo_mode: bool = _flag(os.getenv("KEEPER_DEMO"), False)

    @property
    def mcp_configured(self) -> bool:
        """True when we have enough to talk to a real Dynatrace tenant."""
        return bool(self.dt_environment and self.dt_platform_token)

    @property
    def live(self) -> bool:
        """True when Keeper should use live Dynatrace MCP rather than the script."""
        return self.mcp_configured and not self.demo_mode

    def mcp_env(self) -> dict[str, str]:
        """Environment passed to the Dynatrace MCP server process."""
        env = {
            "DT_ENVIRONMENT": self.dt_environment,
            "DT_PLATFORM_TOKEN": self.dt_platform_token,
            "DT_GRAIL_QUERY_BUDGET_GB": self.dt_grail_budget_gb,
        }
        # Pass through PATH so npx resolves on the host.
        if os.getenv("PATH"):
            env["PATH"] = os.environ["PATH"]
        return env


settings = Settings()
