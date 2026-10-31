/**
 * Finds which class holds `public static void main`, so users can name their class anything,
 * declare several classes, or add a package line. The file must be named after the public class.
 */
export interface MainInfo { fileName: string; mainClass: string }

/** Blank out comments, string/char literals and text blocks (keeping length and newlines). */
function sanitize(s: string): string {
  const out = s.split("");
  const blank = (from: number, to: number) => { for (let k = from; k < to; k++) if (s[k] !== "\n") out[k] = " "; };
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("//", i)) {
      const e = s.indexOf("\n", i);
      const stop = e < 0 ? s.length : e;
      blank(i, stop); i = stop;
    } else if (s.startsWith("/*", i)) {
      const e = s.indexOf("*/", i + 2);
      const stop = e < 0 ? s.length : e + 2;
      blank(i, stop); i = stop;
    } else if (s.startsWith('"""', i)) {
      const e = s.indexOf('"""', i + 3);
      const stop = e < 0 ? s.length : e + 3;
      blank(i, stop); i = stop;
    } else if (s[i] === '"' || s[i] === "'") {
      const q = s[i];
      const start = i++;
      while (i < s.length && s[i] !== q && s[i] !== "\n") i += s[i] === "\\" ? 2 : 1;
      if (s[i] === q) i++;
      blank(start, Math.min(i, s.length));
    } else i++;
  }
  return out.join("");
}

export function detectMain(code: string): MainInfo | { error: string } {
  const s = sanitize(code);

  const depthAt = new Int32Array(s.length + 1);
  let d = 0;
  for (let i = 0; i < s.length; i++) {
    depthAt[i] = d;
    if (s[i] === "{") d++;
    else if (s[i] === "}") d--;
  }

  const decls = [...s.matchAll(/\b(?:class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/g)]
    .filter((m) => depthAt[m.index!] === 0)
    .map((m) => {
      const before = s.slice(0, m.index!);
      const start = Math.max(before.lastIndexOf(";"), before.lastIndexOf("}"), before.lastIndexOf("{")) + 1;
      return { name: m[1], idx: m.index!, isPublic: /\bpublic\b/.test(before.slice(start)) };
    });

  const mainAt = s.search(/\bstatic\b[^;{}()=]*\bvoid\s+main\s*\(/);
  if (mainAt < 0) return { error: "Couldn't find `public static void main(String[] args)` in your code." };

  const owner = [...decls].reverse().find((x) => x.idx < mainAt);
  if (!owner) return { error: "The main method must be inside a class." };

  const publicDecl = decls.find((x) => x.isPublic);
  const pkg = /^\s*package\s+([\w.]+)\s*;/m.exec(s)?.[1];
  return {
    fileName: `${(publicDecl ?? owner).name}.java`,
    mainClass: pkg ? `${pkg}.${owner.name}` : owner.name,
  };
}
