import { Lightbulb, Loader2 } from "lucide-react";
import type { Level, LineDoc, Step } from "../types/trace";
import { narrate } from "../utils/narrate";
import Inline from "./Inline";

interface Props {
  step: Step; prev?: Step; lineText?: string; doc?: LineDoc;
  aiState: "idle" | "loading" | "ready" | "unavailable";
  level: Level; setLevel: (l: Level) => void;
  language: string; setLanguage: (l: string) => void;
}

export const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Spanish"];
const EVENT_LABEL: Record<string, string> = { call: "method call", return: "method return", exception: "exception", end: "finished", line: "" };

export default function ExplainPanel({ step, prev, lineText, doc, aiState, level, setLevel, language, setLanguage }: Props) {
  const facts = narrate(prev, step);
  const sel = "rounded-md border border-line-strong bg-panel px-1.5 py-0.5 text-xs";
  return (
    <section aria-live="polite" className="flex min-h-0 flex-1 flex-col border-t border-line bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Lightbulb size={14} className="text-warn" />What this line does</h2>
        <div className="flex gap-2">
          <select className={sel} value={level} onChange={(e) => setLevel(e.target.value as Level)} aria-label="Explanation level">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
          </select>
          <select className={sel} value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Explanation language">
            {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-auto px-3 pb-3 text-sm">
        <div className="mb-2 flex items-center gap-2">
          {lineText && <pre className="min-w-0 flex-1 overflow-x-auto rounded-md bg-sunken px-2 py-1 font-mono text-xs"><span className="text-faint">{step.line}  </span>{lineText.trim()}</pre>}
          {EVENT_LABEL[step.event] && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${step.event === "exception" ? "bg-danger-soft text-danger" : "bg-violet-soft text-violet"}`}>{EVENT_LABEL[step.event]}</span>}
        </div>
        {aiState === "loading" && <p className="flex items-center gap-2 text-muted"><Loader2 size={14} className="animate-spin" />Writing explanations…</p>}
        {doc && (
          <p className="mb-2 leading-relaxed">
            <Inline text={doc.explanation} />
            {doc.concept && <span className="ml-2 rounded-full bg-violet-soft px-2 py-0.5 text-xs text-violet">{doc.concept}</span>}
          </p>
        )}
        {aiState === "unavailable" && !doc && <p className="mb-2 text-xs text-muted">Written line explanations are off on this server. The live change log below still works.</p>}
        {facts.length > 0 && (
          <ul className="list-disc space-y-0.5 pl-5 text-ok">
            {facts.map((f, i) => <li key={i}><Inline text={f} /></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
