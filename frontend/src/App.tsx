import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, Lock, Moon, Pencil, Play, Sun, Upload } from "lucide-react";
import type { Level, LineDoc, Trace } from "./types/trace";
import { fetchExplain, fetchTrace } from "./api/client";
import { SAMPLES, guessFileName } from "./samples";
import { examplePlaceholder, inputWarnings, readsInOrder, usesInput } from "./utils/inputHints";
import { useBackendStatus } from "./hooks/useBackendStatus";
import { useTracePlayer } from "./hooks/useTracePlayer";
import { useTheme } from "./hooks/useTheme";
import CodeEditor from "./components/CodeEditor";
import Controls from "./components/Controls";
import ConsolePanel from "./components/ConsolePanel";
import EmptyState from "./components/EmptyState";
import ExplainPanel from "./components/ExplainPanel";
import FramesPanel from "./components/FramesPanel";
import Logo from "./components/Logo";
import ObjectsPanel from "./components/ObjectsPanel";
import PredictCard from "./components/PredictCard";
import ReferenceArrows from "./components/ReferenceArrows";
import StatusChip from "./components/StatusChip";

const MAX_CODE = 30_000;

interface Banner { tone: "danger" | "warn"; text: string; actions: { label: string; onClick: () => void }[] }
const shortName = (n?: string) => (n ?? "exception").split(".").pop();

export default function App() {
  const { dark, toggle } = useTheme();
  const backend = useBackendStatus();
  const [mode, setMode] = useState<"edit" | "visualize">("edit");
  const [sampleIdx, setSampleIdx] = useState(0);
  const [code, setCode] = useState(SAMPLES[0].code);
  const [stdin, setStdin] = useState(SAMPLES[0].stdin);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [compileErr, setCompileErr] = useState<{ line: number; message: string } | null>(null);

  const [level, setLevel] = useState<Level>("beginner");
  const [language, setLanguage] = useState("English");
  const [docs, setDocs] = useState<Record<number, LineDoc>>({});
  const [aiState, setAiState] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [predict, setPredict] = useState(false);

  const total = trace?.steps.length ?? 0;
  const player = useTracePlayer(total);
  const { idx } = player;
  const step = trace?.steps[idx];
  const prev = idx > 0 ? trace?.steps[idx - 1] : undefined;
  const visualizing = mode === "visualize" && !!trace && !!step;
  const arrowsRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stdinRef = useRef<HTMLTextAreaElement>(null);
  const focusInput = useRef(false);
  const warned = useRef(false);

  const fileName = useMemo(() => guessFileName(code), [code]);
  const needsInput = useMemo(() => usesInput(code), [code]);
  const reads = useMemo(() => readsInOrder(code), [code]);
  const warnings = useMemo(() => inputWarnings(code, stdin), [code, stdin]);

  const run = async () => {
    if (loading) return;
    // A program that reads input but got none would just crash. Ask once, then respect "run anyway".
    if (needsInput && !stdin.trim() && !warned.current) {
      warned.current = true;
      setError(null);
      setNotice("This program reads input, but the input box is empty. Type the values it needs, then press Visualize. Press Visualize again to run without input.");
      stdinRef.current?.focus();
      return;
    }
    setLoading(true); setError(null); setNotice(null); setCompileErr(null);
    try {
      const t = await fetchTrace(code, stdin);
      if (t.status === "compile_error" && t.compileError) {
        setCompileErr(t.compileError);
        setError(`Compile error on line ${t.compileError.line}: ${t.compileError.message}`);
      } else if (t.steps.length === 0) {
        setError(
          t.message ? `Your program didn't get to run: ${t.message}`
          : t.status === "timeout" ? "Timed out before the first line ran. Check for an infinite loop."
          : "The program produced no steps.",
        );
      } else {
        setTrace(t); setMode("visualize"); player.reset();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const editCode = (focusStdin = false) => {
    focusInput.current = focusStdin;
    setMode("edit"); setTrace(null); setError(null); setDocs({}); setAiState("idle"); player.reset();
  };

  useEffect(() => {
    if (mode === "edit" && focusInput.current) { focusInput.current = false; stdinRef.current?.focus(); }
  }, [mode]);

  // Layer B: AI line explanations. Refetch when level/language change. Any failure just turns the layer off.
  const req = useRef(0);
  useEffect(() => {
    if (!trace) return;
    const id = ++req.current;
    setAiState("loading");
    fetchExplain(code, level, language)
      .then((list) => { if (id === req.current) { setDocs(Object.fromEntries(list.map((d) => [d.line, d]))); setAiState("ready"); } })
      .catch(() => { if (id === req.current) { setDocs({}); setAiState("unavailable"); } });
  }, [trace, level, language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && mode === "edit") { e.preventDefault(); void run(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const pickSample = (i: number) => {
    setSampleIdx(i);
    if (i < 0) return;
    warned.current = false; setNotice(null);
    setCode(SAMPLES[i].code); setStdin(SAMPLES[i].stdin); setError(null); setCompileErr(null);
  };

  const onUpload = async (f?: File) => {
    if (!f) return;
    if (f.size > MAX_CODE) { setError(`That file is larger than ${MAX_CODE / 1000} KB. Try a smaller program.`); return; }
    warned.current = false; setNotice(null);
    setCode(await f.text()); setSampleIdx(-1); setError(null); setCompileErr(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  /* ---- top banner: errors, input problems, truncation ---- */
  const crash = useMemo(() => trace?.steps.find((s) => s.event === "exception"), [trace]);
  const inputIssue = (ex?: string): string | undefined => {
    if (!needsInput) return undefined;
    if (ex === "java.util.NoSuchElementException") return "Your program tried to read more input than you typed.";
    if (ex === "java.util.InputMismatchException") return "Your program expected a different kind of value (for example a number) than what you typed.";
    if (ex === "java.lang.NumberFormatException") return "A typed value couldn't be converted to a number.";
    return undefined;
  };
  let banner: Banner | null = null;
  if (error) banner = { tone: "danger", text: error, actions: [] };
  else if (notice) banner = { tone: "warn", text: notice, actions: [] };
  else if (trace && step) {
    if (trace.status === "timeout") {
      banner = { tone: "warn", text: "Timed out. Your program kept running, so it was stopped. The steps recorded before that are shown. Check for an infinite loop.", actions: [] };
    } else if (crash) {
      const issue = inputIssue(crash.exception);
      const actions: Banner["actions"] = [];
      if (issue) actions.push({ label: "Edit input", onClick: () => editCode(true) });
      if (idx !== crash.index) actions.push({ label: "Go to error", onClick: () => player.go(crash.index) });
      banner = { tone: "warn", text: `Uncaught ${shortName(crash.exception)} on line ${crash.line}.${issue ? " " + issue : ""}`, actions };
    } else if (trace.truncated) {
      banner = { tone: "warn", text: `Showing the first ${total - 1} steps. The program then ran to the end, and its complete output is on the last step.`, actions: [] };
    }
  }

  const groups = useMemo(() => [...new Set(SAMPLES.map((s) => s.group))], []);
  const lineText = step ? code.split("\n")[step.line - 1] : undefined;
  const iconBtn = "flex h-9 w-9 items-center justify-center rounded-lg border border-line-strong bg-panel text-muted hover:bg-sunken hover:text-ink";
  const inputEmpty = needsInput && !stdin.trim();

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-panel px-4 py-2">
        <div className="flex items-center gap-2.5">
          <Logo />
          <h1 className="text-lg font-bold tracking-tight">JavaLens</h1>
        </div>
        <span className="hidden text-sm text-muted md:inline">Java Execution Explorer</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusChip state={backend} />
          <select aria-label="Example program" value={sampleIdx} onChange={(e) => pickSample(Number(e.target.value))} disabled={mode === "visualize"}
                  className="h-9 rounded-lg border border-line-strong bg-panel px-2 text-sm disabled:opacity-50">
            {sampleIdx < 0 && <option value={-1}>Your code</option>}
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {SAMPLES.map((s, i) => s.group === g && <option key={s.name} value={i}>{s.name}</option>)}
              </optgroup>
            ))}
          </select>
          {mode === "visualize" && (
            <label className="flex h-9 items-center gap-1.5 rounded-lg border border-line-strong bg-panel px-3 text-sm">
              <input type="checkbox" checked={predict} onChange={(e) => setPredict(e.target.checked)} className="accent-[var(--accent)]" />
              Predict mode
            </label>
          )}
          <button onClick={toggle} className={iconBtn} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title="Toggle theme">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {mode === "edit" ? (
            <button onClick={() => void run()} disabled={loading} title="Ctrl/Cmd + Enter"
                    className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent shadow-card hover:brightness-110 disabled:opacity-60">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              Visualize
            </button>
          ) : (
            <button onClick={() => editCode()}
                    className="flex h-9 items-center gap-2 rounded-lg border border-accent bg-panel px-4 text-sm font-semibold text-accent hover:bg-sunken">
              <Pencil size={14} />Edit code
            </button>
          )}
        </div>
      </header>

      {banner && (
        <div role="alert" className={`flex flex-wrap items-center gap-2 px-4 py-1.5 text-sm ${banner.tone === "danger" ? "bg-danger-soft text-danger" : "bg-warn-soft text-warn"}`}>
          <AlertTriangle size={14} className="shrink-0" />
          <span className="min-w-0 flex-1">{banner.text}</span>
          {banner.actions.map((a) => (
            <button key={a.label} onClick={a.onClick} className="rounded-md border border-current px-2.5 py-0.5 text-xs font-semibold hover:bg-panel/60">{a.label}</button>
          ))}
        </div>
      )}

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* LEFT: code + (input | controls + explanation) */}
        <div className="flex min-h-0 flex-col border-r border-line bg-panel">
          <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-1.5">
            <span className="rounded-md bg-panel px-2.5 py-0.5 font-mono text-xs shadow-card">{fileName}</span>
            {mode === "visualize" ? (
              <span className="flex items-center gap-1 text-xs text-muted"><Lock size={11} />Read-only while visualizing</span>
            ) : (
              <>
                <input ref={fileInput} type="file" accept=".java,text/x-java-source,text/plain" className="hidden" onChange={(e) => void onUpload(e.target.files?.[0])} />
                <button onClick={() => fileInput.current?.click()} className="ml-auto flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs text-muted hover:bg-panel hover:text-ink">
                  <Upload size={12} />Open .java file
                </button>
              </>
            )}
            {mode === "visualize" && (
              <span className="ml-auto flex items-center gap-3 text-xs text-muted">
                <span><span className="font-bold text-done">➜</span> just ran</span>
                <span><span className="font-bold text-next">➜</span> next</span>
              </span>
            )}
          </div>

          <div className="min-h-56 flex-1">
            <CodeEditor
              code={code} dark={dark} readOnly={mode === "visualize"}
              onChange={(v) => { setCode(v); setSampleIdx(-1); setCompileErr(null); warned.current = false; setNotice(null); }}
              nextLine={visualizing ? step?.line : undefined}
              doneLine={visualizing ? prev?.line : undefined}
              error={compileErr}
            />
          </div>

          {mode === "edit" ? (
            <div className={`flex h-52 flex-col border-t border-line ${inputEmpty ? "bg-violet-soft/40" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
                <label htmlFor="stdin" className="text-xs font-semibold">Program input</label>
                {needsInput
                  ? <span className="rounded-full bg-violet-soft px-2 py-0.5 text-xs font-medium text-violet">Your program reads input</span>
                  : <span className="text-xs text-muted">This program doesn't seem to read any</span>}
              </div>
              <p className="px-3 text-xs text-muted">Type the values exactly as a user would, one per line. Scanner also accepts spaces between numbers and words.</p>
              {reads.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 px-3 pt-1.5 text-xs text-muted">
                  <span>Your code reads, in order:</span>
                  {reads.map((r, i) => (
                    <span key={i} className="rounded border border-line-strong bg-panel px-1.5 py-0.5 font-mono text-[11px]"><span className="text-faint">{i + 1}</span> {r.kind}</span>
                  ))}
                </div>
              )}
              <textarea
                id="stdin" ref={stdinRef} value={stdin} spellCheck={false}
                onChange={(e) => { setStdin(e.target.value); warned.current = false; setNotice(null); }}
                placeholder={needsInput ? examplePlaceholder(reads) : "Leave empty if your program doesn't read input"}
                className={`mx-3 mt-1.5 mb-1.5 min-h-0 flex-1 resize-none rounded-md border bg-panel px-2 py-1.5 font-mono text-sm outline-none placeholder:text-faint focus:border-accent ${inputEmpty ? "border-accent" : "border-line-strong"}`}
              />
              {warnings.length > 0 && (
                <ul className="px-3 pb-1.5 text-xs text-warn">
                  {warnings.map((w) => <li key={w}>Heads-up: {w}</li>)}
                </ul>
              )}
            </div>
          ) : (
            visualizing && trace && step && (
              <div className="flex max-h-[55%] min-h-0 flex-col">
                <Controls steps={trace.steps} idx={idx} playing={player.playing} speedMs={player.speedMs}
                          go={player.go} togglePlay={player.togglePlay} setSpeedMs={player.setSpeedMs} />
                {predict && <PredictCard key={idx} step={step} next={trace.steps[idx + 1]} />}
                <div className="flex h-48 min-h-0 flex-col">
                  <ExplainPanel step={step} prev={prev} lineText={lineText} doc={docs[step.line]} aiState={aiState}
                                level={level} setLevel={setLevel} language={language} setLanguage={setLanguage} />
                </div>
              </div>
            )
          )}
        </div>

        {/* RIGHT: output + frames/objects, or the welcome panel */}
        <div className="flex min-h-0 flex-col">
          {visualizing && step ? (
            <>
              <div className="flex h-36 shrink-0 flex-col border-b border-line">
                <h2 className="border-b border-line bg-sunken px-3 py-1 text-xs font-semibold">Print output</h2>
                <div className="min-h-0 flex-1"><ConsolePanel stdout={step.stdout} stderr={step.stderr} command={`java ${fileName.replace(".java", "")}`} /></div>
              </div>
              <div ref={arrowsRef} className="relative min-h-0 flex-1 overflow-auto bg-paper">
                <div className="grid min-w-[34rem] grid-cols-2 gap-10 p-4">
                  <section>
                    <h2 className="mb-3 text-center text-sm font-semibold">Frames</h2>
                    <FramesPanel step={step} prev={prev} />
                  </section>
                  <section>
                    <h2 className="mb-3 text-center text-sm font-semibold">Objects</h2>
                    <ObjectsPanel step={step} prev={prev} />
                  </section>
                </div>
                <ReferenceArrows containerRef={arrowsRef} stepKey={idx} />
              </div>
            </>
          ) : (
            <div className="min-h-0 flex-1 bg-paper"><EmptyState /></div>
          )}
        </div>
      </main>
    </div>
  );
}
