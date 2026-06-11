import { useEffect } from "react";
import { ExternalLink, FileText, X } from "lucide-react";
import type { PostmortemData } from "../types";
import { Markdown } from "./markdown";

export function PostmortemModal({
  data,
  onClose,
}: {
  data: PostmortemData;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-8 bg-ink-900/80 backdrop-blur-sm animate-fade-up"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl w-full max-w-2xl max-h-[86vh] flex flex-col overflow-hidden border border-pitch/20 shadow-pitch"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b hairline">
          <div className="grid place-items-center w-9 h-9 rounded-xl bg-pitch/10 border border-pitch/25 text-pitch">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-white/90 truncate">
              {data.title}
            </h2>
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 mono text-[11px] text-pitch/80 hover:text-pitch transition-colors"
            >
              Open Dynatrace notebook
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center w-8 h-8 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto scroll-thin px-6 py-5">
          <Markdown source={data.markdown} />
        </div>
      </div>
    </div>
  );
}
