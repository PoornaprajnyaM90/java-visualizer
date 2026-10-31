package tracer;

import com.sun.jdi.*;
import com.sun.jdi.connect.Connector;
import com.sun.jdi.connect.LaunchingConnector;
import com.sun.jdi.event.*;
import com.sun.jdi.request.*;

import javax.tools.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * Usage: java -jar tracer.jar <File.java> <stdin.txt> <trace.json> [--main pkg.MainClass] [--max-steps N]
 * 1. compiles with javac -g  2. launches the main class in a debuggee JVM
 * 3. single-steps user code via JDI  4. writes a trace conforming to shared/trace.schema.json
 *
 * If the step cap is reached, tracing stops but the program is allowed to finish,
 * so the final console output is still complete.
 */
public class TraceMain {
    // Time budgets, measured from tracer start (compile + launch included):
    //  - after TRACE_MS we stop recording and let the program finish on its own (truncated trace, full output)
    //  - the program is then given FREE_RUN_MS more; after that, or at HARD_MS in any case, it is killed
    private static final long T0 = System.currentTimeMillis();
    private static final long TRACE_MS = 7_000, FREE_RUN_MS = 4_000, HARD_MS = 12_000;
    private static final int OUT_CAP = 10_000;
    private static final boolean DEBUG = System.getenv("TRACE_DEBUG") != null;

    private final List<Object> steps = new ArrayList<>();
    private final Snapshotter snap = new Snapshotter();
    private final StringBuilder out = new StringBuilder(), err = new StringBuilder();
    private Process proc;
    private int maxSteps = 2500;
    private String mainClass = "Main";
    private String status = "ok";
    private boolean truncated = false, frozen = false;
    private final List<EventRequest> tracing = new ArrayList<>();
    private long killAt = T0 + HARD_MS;
    private Map<String, Object> last;

    public static void main(String[] a) throws Exception {
        Path src = Path.of(a[0]).toAbsolutePath(), stdin = Path.of(a[1]).toAbsolutePath(), outFile = Path.of(a[2]).toAbsolutePath();
        TraceMain t = new TraceMain();
        for (int i = 3; i < a.length - 1; i++) {
            if (a[i].equals("--max-steps")) t.maxSteps = Integer.parseInt(a[i + 1]);
            if (a[i].equals("--main")) t.mainClass = a[i + 1];
        }
        Map<String, Object> result;
        try {
            result = t.run(src, stdin);
        } catch (Throwable e) {
            result = new LinkedHashMap<>();
            result.put("version", 1);
            result.put("status", "runtime_error");
            result.put("message", "The tracer failed: " + e);
            result.put("steps", new ArrayList<>());
            e.printStackTrace();
        }
        Files.writeString(outFile, Json.write(result), StandardCharsets.UTF_8);
        System.exit(0);
    }

    Map<String, Object> run(Path src, Path stdin) throws Exception {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("version", 1);

        /* ---- 1. compile ---- */
        Path classes = src.getParent().resolve("classes");
        Files.createDirectories(classes);
        JavaCompiler jc = ToolProvider.getSystemJavaCompiler();
        DiagnosticCollector<JavaFileObject> diags = new DiagnosticCollector<>();
        boolean ok;
        try (StandardJavaFileManager fm = jc.getStandardFileManager(diags, null, StandardCharsets.UTF_8)) {
            ok = jc.getTask(null, fm, diags, List.of("-g", "-d", classes.toString()), null,
                            fm.getJavaFileObjects(src.toFile())).call();
        }
        if (!ok) {
            result.put("status", "compile_error");
            Map<String, Object> ce = new LinkedHashMap<>();
            ce.put("line", 1);
            ce.put("message", "Compilation failed");
            for (Diagnostic<? extends JavaFileObject> d : diags.getDiagnostics())
                if (d.getKind() == Diagnostic.Kind.ERROR) {
                    ce.put("line", (int) Math.max(1, d.getLineNumber()));
                    ce.put("message", d.getMessage(Locale.ENGLISH));
                    break;
                }
            result.put("compileError", ce);
            result.put("steps", new ArrayList<>());
            return result;
        }

        /* ---- 2. launch debuggee (suspended) ---- */
        LaunchingConnector lc = Bootstrap.virtualMachineManager().defaultConnector();
        Map<String, Connector.Argument> args = lc.defaultArguments();
        args.get("main").setValue(mainClass);
        args.get("options").setValue("-cp " + classes + " -Xmx64m -Xss512k -XX:-UsePerfData");
        VirtualMachine vm = lc.launch(args);
        proc = vm.process();
        try (OutputStream os = proc.getOutputStream()) {          // feed stdin, then EOF
            os.write(Files.readAllBytes(stdin));
        } catch (IOException ignored) { }

        EventRequestManager erm = vm.eventRequestManager();
        ClassPrepareRequest cpr = erm.createClassPrepareRequest();
        cpr.addClassFilter(mainClass);
        cpr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        cpr.enable();
        ExceptionRequest exr = erm.createExceptionRequest(null, false, true);   // uncaught only
        exr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
        exr.enable();
        tracing.add(exr);

        /* ---- 3. event loop (no manual vm.resume(): the VMStartEvent set is resumed below) ---- */
        boolean running = true;
        while (running) {
            EventSet set = vm.eventQueue().remove(500);
            if (set == null) drainAvailable();
            long now = System.currentTimeMillis();
            if (now > killAt) { status = "timeout"; killVm(vm); break; }     // checked on every pass, busy or idle
            if (!frozen && now > T0 + TRACE_MS) freeze();
            if (set == null) continue;
            for (Event e : set) {
                if (DEBUG) System.err.println("EVENT " + e.getClass().getSimpleName());
                try {
                    if (e instanceof VMDeathEvent || e instanceof VMDisconnectEvent) {
                        running = false;
                    } else if (frozen) {
                        // step cap reached: let the program run to completion
                    } else if (e instanceof ClassPrepareEvent cp) {
                        snap.setMainType(cp.referenceType());
                        for (Method m : cp.referenceType().methodsByName("main"))
                            if (m.isStatic() && m.signature().equals("([Ljava/lang/String;)V")) {
                                BreakpointRequest bp = erm.createBreakpointRequest(m.location());
                                bp.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                                bp.enable();
                            }
                    } else if (e instanceof BreakpointEvent be) {
                        be.request().disable();
                        ThreadReference main = be.thread();
                        StepRequest sr = erm.createStepRequest(main, StepRequest.STEP_LINE, StepRequest.STEP_INTO);
                        for (String p : Snapshotter.JDK_PREFIXES) sr.addClassExclusionFilter(p + "*");
                        sr.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                        sr.enable();
                        tracing.add(sr);
                        if (vm.canGetMethodReturnValues()) {
                            MethodExitRequest mx = erm.createMethodExitRequest();
                            mx.addThreadFilter(main);
                            for (String p : Snapshotter.JDK_PREFIXES) mx.addClassExclusionFilter(p + "*");
                            mx.setSuspendPolicy(EventRequest.SUSPEND_ALL);
                            mx.enable();
                            tracing.add(mx);
                        }
                        record(be.thread(), "line", null, null);
                    } else if (e instanceof StepEvent se) {
                        record(se.thread(), "line", null, null);
                    } else if (e instanceof MethodExitEvent me) {
                        record(me.thread(), "return", me.returnValue(), null);
                    } else if (e instanceof ExceptionEvent ee) {
                        status = "runtime_error";
                        record(ee.thread(), "exception", null, ee.exception().referenceType().name());
                    }
                } catch (VMDisconnectedException gone) {
                    if (DEBUG) gone.printStackTrace();
                    running = false;
                } catch (IncompatibleThreadStateException | ObjectCollectedException | InvalidStackFrameException skip) {
                    if (DEBUG) skip.printStackTrace();          // one unreadable snapshot: skip it, keep tracing
                }
                if (steps.size() >= maxSteps && running) freeze();
            }
            if (running) {
                try { set.resume(); } catch (VMDisconnectedException gone) { running = false; }
            }
        }

        /* ---- 4. final output + "end" step ---- */
        try { proc.waitFor(1, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException ignored) { }
        drainAll();
        if (DEBUG) System.err.println("DEBUGGEE out=[" + out + "] err=[" + err + "]");
        if (last != null) {
            Map<String, Object> end = new LinkedHashMap<>(last);
            end.put("index", steps.size());
            end.put("event", "end");
            end.put("stdout", cap(out));
            end.put("stderr", cap(err));
            end.remove("exception");
            if (frozen) { end.put("stack", new ArrayList<>()); end.put("heap", new LinkedHashMap<>()); end.remove("statics"); }
            steps.add(end);
        }
        if (steps.isEmpty()) {
            String why = (err.length() > 0 ? err.toString() : out.toString()).trim();
            if (why.isEmpty()) why = "The program ended before main() ran.";
            result.put("message", why.length() > 600 ? why.substring(0, 600) : why);
        }
        result.put("status", status);
        if (truncated) result.put("truncated", true);
        result.put("steps", steps);
        return result;
    }

    /** Stop recording; the program keeps running so its complete output is still captured. */
    private void freeze() {
        if (frozen) return;
        frozen = true;
        truncated = true;
        if (status.equals("ok")) status = "step_limit";
        for (EventRequest r : tracing) { try { r.disable(); } catch (Exception ignored) { } }
        killAt = Math.min(killAt, System.currentTimeMillis() + FREE_RUN_MS);
    }

    private void record(ThreadReference t, String event, Value ret, String exception) throws Exception {
        drainAvailable();
        Map<String, Object> s = snap.take(t, steps.size(), event, ret, cap(out), cap(err), exception);
        if ((int) s.get("line") < 1) return;                         // no user frame on stack
        if (event.equals("line") && last != null) {                  // label calls by depth change
            int before = ((List<?>) last.get("stack")).size(), now = ((List<?>) s.get("stack")).size();
            if (now > before) s.put("event", "call");
        }
        steps.add(s);
        last = s;
    }

    /* ---- debuggee stdout/stderr are read synchronously, so output lines up with steps ---- */
    private void drainAvailable() throws IOException {
        pump(proc.getInputStream(), out);
        pump(proc.getErrorStream(), err);
    }

    private void drainAll() {
        try {
            out.append(new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8));
            err.append(new String(proc.getErrorStream().readAllBytes(), StandardCharsets.UTF_8));
        } catch (IOException ignored) { }
    }

    private static void pump(InputStream is, StringBuilder sb) throws IOException {
        int n;
        while ((n = is.available()) > 0) {
            byte[] b = new byte[n];
            int r = is.read(b);
            if (r < 0) break;
            sb.append(new String(b, 0, r, StandardCharsets.UTF_8));
        }
    }

    private static String cap(StringBuilder sb) {
        return sb.length() <= OUT_CAP ? sb.toString() : sb.substring(0, OUT_CAP) + "\n…[output truncated]";
    }

    private static void killVm(VirtualMachine vm) {
        try { vm.exit(1); } catch (Exception ignored) { }
    }
}
