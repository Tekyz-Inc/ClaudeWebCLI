import type { ReactNode } from "react";

// Matches https?:// URLs and Windows/Unix absolute file paths
const TOKEN_RE = /https?:\/\/[^\s"'<>)\]`]+|[A-Za-z]:\\(?:[\w\s.-]+\\)*[\w\s.-]+|\/(?:[\w.-]+\/){1,}[\w.-]+/g;

function toHref(match: string): string {
  if (match.startsWith("http")) return match;
  if (/^[A-Za-z]:/.test(match)) return `file:///${match.replace(/\\/g, "/")}`;
  return `file://${match}`;
}

export function linkifyText(text: string): ReactNode[] {
  const result: ReactNode[] = [];
  let last = 0;
  TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    if (m.index > last) result.push(text.slice(last, m.index));
    const raw = m[0].replace(/[.,;:!?)]+$/, ""); // strip trailing punctuation
    const href = toHref(raw);
    const isUrl = raw.startsWith("http");
    result.push(
      <a
        key={m.index}
        href={href}
        target={isUrl ? "_blank" : undefined}
        rel={isUrl ? "noopener noreferrer" : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`text-cc-primary hover:underline break-all ${isUrl ? "" : "font-mono-code text-[10px]"}`}
      >
        {raw}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) result.push(text.slice(last));
  return result;
}
