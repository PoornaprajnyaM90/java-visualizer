import { useState } from "react";
import type { Step } from "../types/trace";

/** Predict mode: before pressing Next, guess the value a variable will take after this line runs. */
export default function PredictCard({ step, next }: { step: Step; next?: Step }) {
  const [guess, setGuess] = useState("");
  const [checked, setChecked] = useState(false);

  const cur = step.stack[step.stack.length - 1];
  const nxt = next && next.stack.length === step.stack.length ? next.stack[next.stack.length - 1] : undefined;
  const target = nxt && cur && nxt.method === cur.method
    ? nxt.locals.find((l) => {
        if (l.value.kind !== "prim") return false;
        const old = cur.locals.find((x) => x.name === l.name)?.value;
        return JSON.stringify(old) !== JSON.stringify(l.value);
      })
    : undefined;

  if (!target || target.value.kind !== "prim")
    return <div className="border-t border-line bg-sunken px-3 py-2 text-sm text-muted">Nothing to predict on this line. Press Next.</div>;

  const answer = String(target.value.value);
  const correct = guess.trim() === answer;
  return (
    <div className="border-t border-line bg-violet-soft px-3 py-2 text-sm">
      <label className="flex flex-wrap items-center gap-2">
        After this line runs, what will <code className="rounded bg-panel px-1 font-mono">{target.name}</code> be?
        <input
          value={guess} onChange={(e) => { setGuess(e.target.value); setChecked(false); }}
          onKeyDown={(e) => e.key === "Enter" && setChecked(true)}
          className="w-24 rounded-md border border-line-strong bg-panel px-2 py-0.5 font-mono"
        />
        <button onClick={() => setChecked(true)} className="rounded-md bg-accent px-3 py-0.5 text-on-accent hover:brightness-110">Check</button>
      </label>
      {checked && (
        <p className={`mt-1 font-medium ${correct ? "text-ok" : "text-danger"}`}>
          {correct ? "Correct." : `Not quite. It becomes ${answer}.`}
        </p>
      )}
    </div>
  );
}
