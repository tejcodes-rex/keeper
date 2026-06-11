import { Fragment, type ReactNode } from "react";

// Minimal, dependency-free markdown renderer covering the subset the Scribe
// emits: headings, bold inline, list items, horizontal rules, and paragraphs.
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-white/90">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key} className="my-2 space-y-1 pl-1">
        {list.map((item, i) => (
          <li key={i} className="flex gap-2 text-[13px] text-white/70">
            <span className="text-pitch mt-0.5">-</span>
            <span className="leading-relaxed">{inline(item)}</span>
          </li>
        ))}
      </ul>
    );
    list = [];
  };

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      list.push(line.replace(/^\s*([-*]|\d+\.)\s+/, ""));
      return;
    }
    flushList(`ul-${idx}`);

    if (line.startsWith("### ")) {
      blocks.push(
        <h4 key={idx} className="text-sm font-semibold text-white/85 mt-4 mb-1">
          {inline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      blocks.push(
        <h3
          key={idx}
          className="text-[15px] font-semibold text-pitch mt-5 mb-1.5 tracking-wide"
        >
          {inline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h2 key={idx} className="text-lg font-bold text-white/90 mb-2">
          {inline(line.slice(2))}
        </h2>
      );
    } else if (line === "") {
      blocks.push(<div key={idx} className="h-1.5" />);
    } else {
      blocks.push(
        <p key={idx} className="text-[13px] leading-relaxed text-white/70">
          {inline(line)}
        </p>
      );
    }
  });
  flushList("ul-final");

  return <div>{blocks}</div>;
}
