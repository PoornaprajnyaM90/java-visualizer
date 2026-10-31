import type { Step } from "../types/trace";
import { methodLabel } from "../utils/narrate";
import ValueCell from "./ValueCell";

const box = "min-w-10 border border-line-strong bg-panel px-2 py-0.5";

export default function FramesPanel({ step, prev }: { step: Step; prev?: Step }) {
  return (
    <div className="flex flex-col gap-3">
      {step.statics?.map((g) => (
        <div key={g.className} className="w-fit min-w-44 border-l-2 border-line-strong bg-sunken py-1.5 pr-2 pl-2">
          <div className="mb-1 font-mono text-sm font-medium">{g.className} <span className="font-sans text-xs font-normal text-muted">static fields</span></div>
          <table className="ml-auto border-separate border-spacing-y-1 text-sm">
            <tbody>
              {g.fields.map((f) => {
                const old = prev?.statics?.find((x) => x.className === g.className)?.fields.find((x) => x.name === f.name)?.value;
                const changed = !!prev && JSON.stringify(old) !== JSON.stringify(f.value);
                return (
                  <tr key={f.name}>
                    <td className="pr-2 text-right font-mono">{f.name}</td>
                    <td key={`${step.index}-${f.name}`} className={`${box} ${changed ? "changed" : ""}`}><ValueCell v={f.value} heap={step.heap} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {step.stack.map((f, fi) => {
        const current = fi === step.stack.length - 1;
        const pf = prev?.stack[fi]?.method === f.method ? prev.stack[fi] : undefined;
        return (
          <div key={fi} className={`w-fit min-w-44 border-l-2 py-1.5 pr-2 pl-2 ${current ? "border-frame-line bg-frame" : "border-line-strong bg-sunken"}`}>
            <div className="mb-1 font-mono text-sm font-medium">{methodLabel(f.method)}:{f.line}</div>
            <table className="ml-auto border-separate border-spacing-y-1 text-sm">
              <tbody>
                {f.locals.map((l) => {
                  const old = pf?.locals.find((x) => x.name === l.name)?.value;
                  const changed = !!pf && JSON.stringify(old) !== JSON.stringify(l.value);
                  return (
                    <tr key={l.name}>
                      <td className="pr-2 text-right font-mono">{l.name}</td>
                      <td key={`${step.index}-${l.name}`} className={`${box} ${changed ? "changed" : ""}`}>
                        <ValueCell v={l.value} heap={step.heap} />
                      </td>
                    </tr>
                  );
                })}
                {f.returnValue && (
                  <tr>
                    <td className="pr-2 text-right text-sm font-medium text-ret">Return value</td>
                    <td className={box}><ValueCell v={f.returnValue} heap={step.heap} /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
      {step.stack.length === 0 && <p className="text-sm text-muted">The program has finished. All frames are gone.</p>}
    </div>
  );
}
