import { useEffect, useRef } from "react";
import Editor, { type BeforeMount, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";

interface Props {
  code: string;
  onChange: (v: string) => void;
  dark: boolean;
  readOnly: boolean;
  nextLine?: number;          // red arrow: next line to execute
  doneLine?: number;          // green arrow: line that just executed
  error?: { line: number; message: string } | null;
}

const defineThemes: BeforeMount = (m) => {
  m.editor.defineTheme("jl-light", { base: "vs", inherit: true, rules: [], colors: {
    "editor.background": "#ffffff", "editorGutter.background": "#ffffff", "editorLineNumber.foreground": "#98a3b5",
    "editorLineNumber.activeForeground": "#566176" } });
  m.editor.defineTheme("jl-dark", { base: "vs-dark", inherit: true, rules: [], colors: {
    "editor.background": "#0f1623", "editorGutter.background": "#0f1623", "editorLineNumber.foreground": "#637189",
    "editorLineNumber.activeForeground": "#9aa7bd" } });
};

export default function CodeEditor({ code, onChange, dark, readOnly, nextLine, doneLine, error }: Props) {
  const ed = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const mon = useRef<Parameters<OnMount>[1] | null>(null);
  const decos = useRef<MonacoEditor.IEditorDecorationsCollection | null>(null);

  const mount: OnMount = (e, m) => { ed.current = e; mon.current = m; };

  useEffect(() => {
    const e = ed.current;
    if (!e) return;
    decos.current?.clear();
    const list: MonacoEditor.IModelDeltaDecoration[] = [];
    const whole = (line: number, className: string, glyph: string) => ({
      range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
      options: { isWholeLine: true, className, glyphMarginClassName: glyph },
    });
    if (doneLine && doneLine !== nextLine) list.push(whole(doneLine, "line-done", "arrow-green"));
    if (nextLine) list.push(whole(nextLine, "line-next", "arrow-red"));
    decos.current = e.createDecorationsCollection(list);
    if (nextLine) e.revealLineInCenterIfOutsideViewport(nextLine);
  }, [nextLine, doneLine]);

  useEffect(() => {
    const model = ed.current?.getModel();
    const m = mon.current;
    if (!model || !m) return;
    m.editor.setModelMarkers(model, "javalens", error ? [{
      severity: m.MarkerSeverity.Error,
      message: error.message,
      startLineNumber: error.line, startColumn: 1,
      endLineNumber: error.line, endColumn: model.getLineMaxColumn(Math.min(error.line, model.getLineCount())),
    }] : []);
  }, [error, code]);

  return (
    <Editor
      height="100%"
      language="java"
      theme={dark ? "jl-dark" : "jl-light"}
      beforeMount={defineThemes}
      value={code}
      onChange={(v) => onChange(v ?? "")}
      onMount={mount}
      options={{
        readOnly,
        domReadOnly: readOnly,
        minimap: { enabled: false },
        fontSize: 14,
        fontFamily: "'JetBrains Mono', monospace",
        lineNumbers: "on",
        glyphMargin: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        renderLineHighlight: "none",
        padding: { top: 8 },
      }}
    />
  );
}
