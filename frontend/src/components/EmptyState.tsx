import { Boxes, Layers, Lightbulb, Wand2 } from "lucide-react";

const features = [
  { icon: Layers, title: "Call stack", text: "Every method call gets its own frame. Watch frames appear and disappear." },
  { icon: Boxes, title: "Objects & arrows", text: "See which variable points to which array or object, including shared references." },
  { icon: Lightbulb, title: "Plain-English lines", text: "Each line is explained in your level and language, plus a live log of what changed." },
  { icon: Wand2, title: "Predict mode", text: "Guess the next value before you step. Learn by being wrong, safely." },
];

export default function EmptyState() {
  return (
    <div className="flex h-full flex-col justify-center gap-6 overflow-auto p-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Where code meets clarity</h2>
        <p className="mt-1 max-w-md text-muted">" Transform your Java code into dynamic, Write your Java logic on the left and see how the JVM thinks on the right..”</p>
      </div>
      <ol className="grid max-w-xl gap-3 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-xl border border-line bg-panel p-3.5 shadow-card">
            <Icon size={18} className="mb-1.5 text-accent" />
            <div className="font-semibold">{title}</div>
            <div className="text-sm text-muted">{text}</div>
          </li>
        ))}
      </ol>
      <p className="text-xs text-faint">Shortcut: Ctrl or Cmd + Enter to visualize. Left and right arrow keys to step.</p>
    </div>
  );
}
