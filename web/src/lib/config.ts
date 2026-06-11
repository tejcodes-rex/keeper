// Runtime configuration resolved from Vite env vars and URL query params.

const params = new URLSearchParams(window.location.search);

export const KEEPER_URL: string = (
  import.meta.env.VITE_KEEPER_URL || "http://localhost:8000"
).replace(/\/$/, "");

// Mock mode is on if VITE_MOCK === "1" or ?mock=1 is present in the URL.
export const MOCK_MODE: boolean =
  import.meta.env.VITE_MOCK === "1" || params.get("mock") === "1";
