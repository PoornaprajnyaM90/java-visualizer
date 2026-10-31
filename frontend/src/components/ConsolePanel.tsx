import { useEffect, useRef } from "react";

export default function ConsolePanel({ stdout, stderr, command }: { stdout: string; stderr: string; command: string }) {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight }); }, [stdout, stderr]);
  return (
    <pre ref={ref} className="h-full overflow-auto bg-panel px-3 py-2 font-mono text-[13px] leading-relaxed whitespace-pre-wrap">
      <span className="text-faint select-none">$ {command}{"\n"}</span>
      {stdout}
      <span className="text-danger">{stderr}</span>
    </pre>
  );
}
