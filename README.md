# JavaLens: a Java code visualizer with line-by-line explanations

Write Java, give it stdin, then step forward and backward through execution. Each step shows the
call stack, local variables, heap objects with reference arrows, console output, and a plain-English
explanation of the line being run.

```
Browser (React + Monaco) -> Express API -> docker run (no network, capped CPU/RAM/PIDs)
                                              -> tracer.jar (JDI) -> debuggee JVM (user code)
                                              -> trace.json -> validated against shared/trace.schema.json
```

## Folder structure

```
java-visualizer/
├── docker-compose.yml            # builds the sandbox image
├── shared/trace.schema.json      # single source of truth for the trace format
├── sandbox/
│   ├── Dockerfile                # JDK 21, non-root user, tracer.jar
│   └── tracer/                   # JDI tracer (Maven)
│       ├── pom.xml
│       └── src/main/java/tracer/
│           ├── TraceMain.java    # compile, launch debuggee, step loop, write trace.json
│           ├── Snapshotter.java  # frames + heap walk, stable ids (@1, @2...), ArrayList/HashMap rendering
│           └── Json.java         # tiny dependency-free JSON writer
├── backend/                      # Node + Express + TypeScript
│   └── src/
│       ├── server.ts, config.ts
│       ├── routes/trace.route.ts     # POST /api/trace   {code, stdin} -> trace
│       ├── routes/explain.route.ts   # POST /api/explain {code, level, language} -> per-line docs (AI, optional)
│       ├── services/dockerRunner.ts  # sandboxed container per run
│       ├── services/traceValidator.ts
│       └── middleware/errorHandler.ts
└── frontend/                     # React + TypeScript + Tailwind + Monaco
    └── src/
        ├── App.tsx               # layout and state
        ├── api/client.ts, samples.ts, types/trace.ts
        ├── mock/mockTrace.ts     # UI works without a backend (VITE_USE_MOCK=true)
        ├── hooks/useTracePlayer.ts   # step index, autoplay, speed, arrow keys
        ├── hooks/useTheme.ts         # light/dark, remembered in localStorage
        ├── utils/narrate.ts      # "what changed" log, computed from the trace, no AI
        └── components/
            ├── CodeEditor.tsx        # green/red arrows, compile-error squiggles
            ├── Controls.tsx          # slider, First/Prev/Next/Last, autoplay + speed
            ├── FramesPanel.tsx, ObjectsPanel.tsx, ValueCell.tsx
            ├── ReferenceArrows.tsx   # SVG arrows from variables to objects
            ├── ConsolePanel.tsx, ExplainPanel.tsx, PredictCard.tsx, Inline.tsx
```

## What's new in this version

- Edit code / Visualize modes (the editor is read-only while stepping, like Python Tutor).
- Light and dark themes. All colors live in `frontend/src/index.css` as tokens.
- Any Java program: the class with `main` is detected automatically, so `Calculator`, `BankApp`,
  or several classes in one file all work. `package` lines work too.
- Timeline strip: the whole run as a depth chart (recursion shows up as a mountain).
- More of Java is rendered: static fields, enums, records, `StringBuilder`, `ArrayList`, `LinkedList`,
  `ArrayDeque`, `Stack`, `PriorityQueue`, `HashSet`, `TreeSet`, `HashMap`, `LinkedHashMap`, `TreeMap`, `List.of`.
- If a program exceeds the step cap, tracing stops but the program still runs to the end, so the
  final output is complete.

**After pulling this update, rebuild the sandbox image** (`docker compose build sandbox`) and run
`npm install` in `backend/` (new dependency: compression).

## Program input (Scanner, BufferedReader, System.in)

- The **Program input** box is under the editor. Type values exactly as a user would, one per line.
- The app scans your code and shows what it reads, in order (`1 integer`, `2 word`, `3 line` ...),
  fills the placeholder with an example, and warns if a value looks wrong for the call
  (for example text where `nextInt()` runs).
- If the box is empty and the program reads input, Visualize asks once before running.
- If the program asks for more input than you typed, or the wrong type, the banner says so and
  has an **Edit input** button that returns you to the input box. **Go to error** jumps to the failing step.

## Status light and demo mode

The chip in the header shows `Ready`, `Backend offline`, `Docker not running`, `Sandbox not built`, or
`Demo data`. **Demo data** means `VITE_USE_MOCK=true`: the app replays one canned example and cannot
run your code (it now refuses other programs with a clear message). For real runs keep
`frontend/.env` at `VITE_USE_MOCK=false` or delete the file, then restart `npm run dev`.

## Run it

```bash
# 1. sandbox image (needs Docker)
docker compose build sandbox

# 2. backend
cd backend && cp .env.example .env && npm install
npm run dev                       # http://localhost:4000

# 3. frontend
cd frontend && npm install
npm run dev                       # http://localhost:5173  (proxies /api to :4000)
```

UI-only work: `VITE_USE_MOCK=true npm run dev` in `frontend/` (the mock matches the "Sum an array" sample).

Line explanations need `ANTHROPIC_API_KEY` in `backend/.env`. Without it the app still works and
shows the computed change log ("`s` changed from 3 to 8").

## The two explanation layers

- Layer A, `utils/narrate.ts`: diffs consecutive steps and states facts. Instant, free, cannot be wrong.
- Layer B, `/api/explain`: one AI call per run explains every line (what it means and why it is there),
  cached by code hash, in the chosen level and language. If it fails, Layer A still works.

## Deploying

Fastest path: upload the folder to a fresh Ubuntu server and run `sudo bash deploy/setup.sh your-domain.com`.
See `deploy/`: a Caddyfile (HTTPS + serves the frontend + proxies `/api`), a systemd unit for the API,
and `update.sh`. The backend must run on a machine where Docker is available (a VPS), not on
Vercel/Netlify-style hosts. In production set `HOST=127.0.0.1` and `TRUST_PROXY=1` in `backend/.env`.

## Known limits

- One source file. It needs a `public static void main(String[] args)` somewhere (any class name).
- Stepping is per line. Several statements on one line are one step. A loop whose body is a single
  line that jumps to itself may produce no step events and ends as a timeout.
- Recording stops after 2500 steps or about 7 seconds (whichever comes first); the program is then allowed to
  finish (up to ~4 more seconds) so its output is complete. A program still running after that is stopped and
  reported as a timeout. Also:  50 elements per array, 150 heap objects, 60 frames. Programs that use
  threads are traced on the main thread only.
- Other JDK objects (e.g. `Optional`, `LocalDate`) show only their class name.
- Stdin is supplied up front. A program that reads past it gets EOF.

## Security (read before going public)

Never run user code in the API process. The container uses `--network none`, memory/CPU/PID limits,
read-only root, dropped capabilities, and a non-root user. Containers share the host kernel, so for a public
service add gVisor (`--runtime=runsc`) or Firecracker, and keep execution hosts separate from secrets.
Do not mount the Docker socket into anything user-facing; run the API on the host or on a dedicated
worker with a narrow docker wrapper.

## Roadmap

1. Run the tracer on 20 classic programs and keep the outputs as golden files in CI.
2. Share links (`/s/:id`) stored in Postgres/Redis; example gallery.
3. Job queue (BullMQ) with warm sandbox workers; per-IP quotas; metrics.
4. Trace deltas instead of full snapshots for long runs; virtualised lists.
5. Static fields, linked-list/tree layouts, more collections (LinkedList, TreeMap, HashSet).
