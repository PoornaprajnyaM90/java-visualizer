import type { ReactNode } from "react";

/** Renders **bold** and `code` from narration strings. No HTML injection: everything stays a React text node. */
export default function Inline({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    parts.push(t.startsWith("**")
      ? <b key={k++}>{t.slice(2, -2)}</b>
      : <code key={k++} className="rounded bg-sunken px-1 font-mono text-[0.85em]">{t.slice(1, -1)}</code>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
