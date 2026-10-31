package tracer;

import com.sun.jdi.*;
import java.util.*;

/**
 * Turns the suspended debuggee thread into one trace "step":
 * frames (outermost first), static fields, and the heap objects reachable from them.
 * Heap ids are remapped to small, stable ids (@1, @2, ...) across the whole run.
 */
final class Snapshotter {
    static final String[] JDK_PREFIXES = {"java.", "javax.", "jdk.", "sun.", "com.sun."};
    private static final int MAX_ELEMS = 50, MAX_HEAP = 150, MAX_FRAMES = 60, MAX_ENTRIES = 30;
    private static final Set<String> BOXED = Set.of(
        "java.lang.Integer", "java.lang.Long", "java.lang.Double", "java.lang.Float",
        "java.lang.Short", "java.lang.Byte", "java.lang.Character", "java.lang.Boolean");

    private final Map<Long, String> ids = new HashMap<>();
    private int nextId = 1;
    private Map<String, Object> heap;
    private Deque<ObjectReference> queue;
    private Set<Long> seen;
    private boolean cut;
    private ReferenceType mainType;

    void setMainType(ReferenceType t) { mainType = t; }

    static boolean isJdk(String className) {
        for (String p : JDK_PREFIXES) if (className.startsWith(p)) return true;
        return false;
    }

    Map<String, Object> take(ThreadReference t, int index, String event, Value returnValue,
                             String stdout, String stderr, String exception) throws Exception {
        heap = new LinkedHashMap<>();
        queue = new ArrayDeque<>();
        seen = new HashSet<>();

        List<StackFrame> frames = t.frames(0, Math.min(t.frameCount(), MAX_FRAMES));
        List<Object> stack = new ArrayList<>();
        Set<ReferenceType> types = new LinkedHashSet<>();
        if (mainType != null) types.add(mainType);
        int topLine = -1;
        // The innermost *user* frame. An exception thrown inside the JDK (e.g. Scanner running out of input)
        // is reported on the user line that called it.
        int topUser = -1;
        for (int i = 0; i < frames.size() && topUser < 0; i++)
            if (!isJdk(frames.get(i).location().declaringType().name())) topUser = i;

        for (int i = frames.size() - 1; i >= 0; i--) {           // outermost first
            StackFrame f = frames.get(i);
            Location loc = f.location();
            if (isJdk(loc.declaringType().name())) continue;
            types.add(loc.declaringType());
            Map<String, Object> fm = new LinkedHashMap<>();
            fm.put("method", simple(loc.declaringType().name()) + "." + loc.method().name());
            fm.put("line", loc.lineNumber());
            List<Object> locals = new ArrayList<>();
            if (!loc.method().isStatic()) {
                ObjectReference self = f.thisObject();
                if (self != null) locals.add(named("this", value(self)));
            }
            try {
                List<LocalVariable> vars = f.visibleVariables();
                Map<LocalVariable, Value> vals = vars.isEmpty() ? Map.of() : f.getValues(vars);   // one round trip
                for (LocalVariable lv : vars) locals.add(named(lv.name(), value(vals.get(lv))));
            } catch (AbsentInformationException ignored) { }
            fm.put("locals", locals);
            if (i == topUser) {
                topLine = loc.lineNumber();
                if (returnValue != null && !(returnValue instanceof VoidValue))
                    fm.put("returnValue", value(returnValue));
            }
            stack.add(fm);
        }
        List<Object> statics = statics(types);
        while (!queue.isEmpty() && heap.size() < MAX_HEAP) describe(queue.poll());

        Map<String, Object> step = new LinkedHashMap<>();
        step.put("index", index);
        step.put("event", event);
        step.put("line", topLine);
        step.put("stack", stack);
        if (!statics.isEmpty()) step.put("statics", statics);
        step.put("heap", heap);
        step.put("stdout", stdout);
        step.put("stderr", stderr);
        if (exception != null) step.put("exception", exception);
        return step;
    }

    private List<Object> statics(Set<ReferenceType> types) {
        List<Object> out = new ArrayList<>();
        for (ReferenceType t : types) {
            try {
                List<Field> sf = new ArrayList<>();
                for (Field f : t.fields()) if (f.isStatic() && !f.isSynthetic() && !f.isEnumConstant()) sf.add(f);
                if (sf.isEmpty()) continue;
                Map<Field, Value> sv = t.getValues(sf);
                List<Object> fs = new ArrayList<>();
                for (Field f : sf) fs.add(named(f.name(), value(sv.get(f))));
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("className", simple(t.name()));
                m.put("fields", fs);
                out.add(m);
            } catch (ClassNotPreparedException ignored) { }
        }
        return out;
    }

    /* ---------- values ---------- */

    private Map<String, Object> named(String name, Object value) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("name", name);
        m.put("value", value);
        return m;
    }

    private Object value(Value v) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (v == null) { m.put("kind", "null"); return m; }
        if (v instanceof PrimitiveValue) {
            m.put("kind", "prim");
            m.put("type", v.type().name());
            if (v instanceof BooleanValue b) m.put("value", b.value());
            else if (v instanceof CharValue c) m.put("value", String.valueOf(c.value()));
            else if (v instanceof DoubleValue || v instanceof FloatValue) m.put("value", v.toString());
            else m.put("value", ((PrimitiveValue) v).longValue());
            return m;
        }
        if (v instanceof ObjectReference o) {
            m.put("kind", "ref");
            m.put("id", refId(o));
            return m;
        }
        m.put("kind", "null");
        return m;
    }

    private String refId(ObjectReference o) {
        String id = ids.computeIfAbsent(o.uniqueID(), k -> "@" + nextId++);
        if (seen.add(o.uniqueID())) queue.add(o);
        return id;
    }

    /* ---------- field helpers (search inherited fields too) ---------- */

    private Value fv(ObjectReference o, String name) {
        ReferenceType rt = o.referenceType();
        Field f = rt.fieldByName(name);
        if (f == null) for (Field x : rt.allFields()) if (x.name().equals(name)) { f = x; break; }
        return f == null ? null : o.getValue(f);
    }

    private int iv(ObjectReference o, String name) {
        return fv(o, name) instanceof IntegerValue i ? i.value() : 0;
    }

    /* ---------- heap objects ---------- */

    private void describe(ObjectReference o) {
        String id = ids.get(o.uniqueID());
        Map<String, Object> h = new LinkedHashMap<>();
        try {
            String cn = o.referenceType().name();
            h.put("className", simple(cn));
            if (o instanceof StringReference s) {
                h.put("kind", "string");
                String str = s.value();
                h.put("display", str.length() > 200 ? str.substring(0, 200) + "…" : str);
            } else if (o instanceof ArrayReference a) {
                h.put("kind", "array");
                int n = Math.min(a.length(), MAX_ELEMS);
                List<Object> els = new ArrayList<>();
                if (n > 0) for (Value ev : a.getValues(0, n)) els.add(value(ev));              // one round trip
                h.put("elements", els);
                if (a.length() > n) h.put("truncated", true);
            } else if (BOXED.contains(cn)) {
                h.put("kind", "boxed");
                h.put("display", String.valueOf(fv(o, "value")).replace("\"", ""));
            } else if (isEnum(o)) {
                h.put("kind", "boxed");
                Value nm = fv(o, "name");
                h.put("display", nm instanceof StringReference sr ? sr.value() : "?");
            } else if (cn.equals("java.lang.StringBuilder") || cn.equals("java.lang.StringBuffer")) {
                h.put("kind", "boxed");
                h.put("display", "\"" + builderText(o) + "\"");
            } else if (cn.equals("java.util.HashMap") || cn.equals("java.util.LinkedHashMap") || cn.equals("java.util.TreeMap")) {
                h.put("kind", "map");
                List<Object> es = new ArrayList<>();
                for (ObjectReference nd : entryNodes(o)) {
                    Map<String, Object> e = new LinkedHashMap<>();
                    e.put("key", value(fv(nd, "key")));
                    e.put("value", value(fv(nd, "value")));
                    es.add(e);
                }
                h.put("entries", es);
            } else {
                cut = false;
                List<Value> els = listOf(o, cn);
                if (els != null) {
                    h.put("kind", "list");
                    List<Object> conv = new ArrayList<>();
                    for (Value v : els) conv.add(value(v));
                    h.put("elements", conv);
                    if (cut) h.put("truncated", true);
                } else if (isJdk(cn)) {
                    h.put("kind", "object");                      // other JDK types: class name only
                } else {
                    h.put("kind", "object");
                    List<Field> fl = new ArrayList<>();
                    for (Field f : o.referenceType().allFields()) if (!f.isStatic() && !f.isSynthetic()) fl.add(f);
                    Map<Field, Value> fvals = fl.isEmpty() ? Map.of() : o.getValues(fl);          // one round trip
                    List<Object> fields = new ArrayList<>();
                    for (Field f : fl) fields.add(named(f.name(), value(fvals.get(f))));
                    h.put("fields", fields);
                }
            }
        } catch (Exception e) {                                   // collected / unreadable object
            h.putIfAbsent("kind", "object");
            h.putIfAbsent("className", "?");
        }
        heap.put(id, h);
    }

    private boolean isEnum(ObjectReference o) {
        if (!(o.referenceType() instanceof ClassType ct)) return false;
        for (ClassType c = ct; c != null; c = c.superclass()) if (c.name().equals("java.lang.Enum")) return true;
        return false;
    }

    private String builderText(ObjectReference o) {
        int count = iv(o, "count");
        int coder = fv(o, "coder") instanceof ByteValue b ? b.value() : 0;
        if (!(fv(o, "value") instanceof ArrayReference a) || count == 0) return "";
        int n = Math.min(count, 100);
        StringBuilder sb = new StringBuilder();
        if (coder == 0) {
            for (Value x : a.getValues(0, n)) sb.append((char) (((ByteValue) x).value() & 0xff));
        } else {
            List<Value> bs = a.getValues(0, n * 2);
            for (int i = 0; i + 1 < bs.size(); i += 2)
                sb.append((char) (((((ByteValue) bs.get(i + 1)).value() & 0xff) << 8) | (((ByteValue) bs.get(i)).value() & 0xff)));
        }
        if (count > n) sb.append("…");
        return sb.toString();
    }

    /* ---------- collections: returns raw element values, or null if not a known collection ---------- */

    private void take(Value arr, int from, int n, List<Value> out) {
        if (!(arr instanceof ArrayReference a)) return;
        int m = Math.min(n, MAX_ELEMS);
        if (m > 0) out.addAll(a.getValues(from, m));
        if (n > m) cut = true;
    }

    private List<Value> listOf(ObjectReference o, String cn) {
        List<Value> out = new ArrayList<>();
        switch (cn) {
            case "java.util.ArrayList" -> take(fv(o, "elementData"), 0, iv(o, "size"), out);
            case "java.util.Vector", "java.util.Stack" -> take(fv(o, "elementData"), 0, iv(o, "elementCount"), out);
            case "java.util.PriorityQueue" -> take(fv(o, "queue"), 0, iv(o, "size"), out);
            case "java.util.Arrays$ArrayList" -> {
                Value a = fv(o, "a");
                if (a instanceof ArrayReference ar) take(a, 0, ar.length(), out);
            }
            case "java.util.ImmutableCollections$ListN" -> {
                Value a = fv(o, "elements");
                if (a instanceof ArrayReference ar) take(a, 0, ar.length(), out);
            }
            case "java.util.ImmutableCollections$List12" -> {
                out.add(fv(o, "e0"));
                if (fv(o, "e1") instanceof ObjectReference r && !r.referenceType().name().equals("java.lang.Object")) out.add(r);
            }
            case "java.util.LinkedList" -> {
                Value n = fv(o, "first");
                while (n instanceof ObjectReference nd && out.size() < MAX_ELEMS) { out.add(fv(nd, "item")); n = fv(nd, "next"); }
                cut = n instanceof ObjectReference;
            }
            case "java.util.ArrayDeque" -> {
                if (fv(o, "elements") instanceof ArrayReference a) {
                    int head = iv(o, "head"), tail = iv(o, "tail"), len = a.length();
                    for (int i = head; i != tail && out.size() < MAX_ELEMS && len > 0; i = (i + 1) % len) out.add(a.getValue(i));
                    cut = out.size() >= MAX_ELEMS;
                }
            }
            case "java.util.HashSet", "java.util.LinkedHashSet" -> {
                if (fv(o, "map") instanceof ObjectReference m) for (ObjectReference nd : entryNodes(m)) out.add(fv(nd, "key"));
            }
            case "java.util.TreeSet" -> {
                if (fv(o, "m") instanceof ObjectReference m) for (ObjectReference nd : entryNodes(m)) out.add(fv(nd, "key"));
            }
            default -> { return null; }
        }
        return out;
    }

    /** Entry/node objects of a HashMap, LinkedHashMap (insertion order) or TreeMap (sorted). */
    private List<ObjectReference> entryNodes(ObjectReference map) {
        List<ObjectReference> nodes = new ArrayList<>();
        String cn = map.referenceType().name();
        if (cn.equals("java.util.TreeMap")) {
            Deque<ObjectReference> st = new ArrayDeque<>();
            Value cur = fv(map, "root");
            while ((cur instanceof ObjectReference || !st.isEmpty()) && nodes.size() < MAX_ENTRIES) {
                while (cur instanceof ObjectReference c) { st.push(c); cur = fv(c, "left"); }
                ObjectReference n = st.pop();
                nodes.add(n);
                cur = fv(n, "right");
            }
        } else if (cn.equals("java.util.LinkedHashMap")) {
            Value n = fv(map, "head");
            while (n instanceof ObjectReference node && nodes.size() < MAX_ENTRIES) { nodes.add(node); n = fv(node, "after"); }
        } else if (fv(map, "table") instanceof ArrayReference table) {
            for (int i = 0; i < table.length() && nodes.size() < MAX_ENTRIES; i++) {
                Value n = table.getValue(i);
                while (n instanceof ObjectReference node && nodes.size() < MAX_ENTRIES) { nodes.add(node); n = fv(node, "next"); }
            }
        }
        return nodes;
    }

    static String simple(String name) {
        int dot = name.lastIndexOf('.');
        String s = dot >= 0 ? name.substring(dot + 1) : name;
        int d = s.lastIndexOf('$');
        return d >= 0 ? s.substring(d + 1) : s;
    }
}
