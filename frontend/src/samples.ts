export interface Sample { group: string; name: string; code: string; stdin: string }

export const SAMPLES: Sample[] = [
  { group: "Basics", name: "Sum an array", stdin: "", code: `public class Main {
    static int sum(int[] a) {
        int s = 0;
        for (int i = 0; i < a.length; i++) {
            s += a[i];
        }
        return s;
    }
    public static void main(String[] args) {
        int[] nums = {3, 5, 7};
        int total = sum(nums);
        System.out.println("Total: " + total);
    }
}` },
  { group: "Basics", name: "Reading input (Scanner)", stdin: "5\n3", code: `import java.util.Scanner;

public class Calculator {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        int sum = a + b;
        System.out.println("Sum = " + sum);
    }
}` },
  { group: "Recursion", name: "Factorial", stdin: "", code: `public class Main {
    static int fact(int n) {
        if (n <= 1) {
            return 1;
        }
        return n * fact(n - 1);
    }
    public static void main(String[] args) {
        int result = fact(5);
        System.out.println("5! = " + result);
    }
}` },
  { group: "Recursion", name: "Fibonacci", stdin: "", code: `public class Main {
    static int fib(int n) {
        if (n < 2) return n;
        return fib(n - 1) + fib(n - 2);
    }
    public static void main(String[] args) {
        System.out.println(fib(5));
    }
}` },
  { group: "Algorithms", name: "Bubble sort", stdin: "", code: `public class Main {
    public static void main(String[] args) {
        int[] a = {5, 2, 9, 1, 4};
        for (int i = 0; i < a.length - 1; i++) {
            for (int j = 0; j < a.length - 1 - i; j++) {
                if (a[j] > a[j + 1]) {
                    int tmp = a[j];
                    a[j] = a[j + 1];
                    a[j + 1] = tmp;
                }
            }
        }
        System.out.println(java.util.Arrays.toString(a));
    }
}` },
  { group: "Algorithms", name: "Binary search", stdin: "", code: `public class Main {
    static int search(int[] a, int target) {
        int lo = 0, hi = a.length - 1;
        while (lo <= hi) {
            int mid = (lo + hi) / 2;
            if (a[mid] == target) return mid;
            if (a[mid] < target) lo = mid + 1;
            else hi = mid - 1;
        }
        return -1;
    }
    public static void main(String[] args) {
        int[] a = {1, 3, 5, 7, 9, 11};
        System.out.println(search(a, 7));
    }
}` },
  { group: "Objects", name: "Linked nodes & references", stdin: "", code: `public class Main {
    static class Node {
        int val;
        Node next;
        Node(int val) { this.val = val; }
    }
    public static void main(String[] args) {
        Node a = new Node(1);
        Node b = new Node(2);
        a.next = b;
        Node c = a;
        c.val = 99;
        System.out.println(a.val);
    }
}` },
  { group: "Objects", name: "Inheritance & interfaces", stdin: "", code: `interface Shape {
    double area();
}

class Circle implements Shape {
    double r;
    Circle(double r) { this.r = r; }
    public double area() { return 3.14 * r * r; }
}

class Rect implements Shape {
    double w, h;
    Rect(double w, double h) { this.w = w; this.h = h; }
    public double area() { return w * h; }
}

public class Shapes {
    static int created = 0;
    public static void main(String[] args) {
        Shape[] shapes = { new Circle(2), new Rect(3, 4) };
        double total = 0;
        for (Shape s : shapes) {
            total += s.area();
            created++;
        }
        System.out.println("Total area: " + total);
    }
}` },
  { group: "Collections", name: "ArrayList & HashMap", stdin: "", code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        List<String> names = new ArrayList<>();
        names.add("Asha");
        names.add("Ravi");
        Map<String, Integer> ages = new HashMap<>();
        ages.put("Asha", 21);
        ages.put("Ravi", 23);
        System.out.println(names.size() + " people");
    }
}` },
  { group: "Collections", name: "Stack, Queue & lambdas", stdin: "", code: `import java.util.*;

public class Main {
    public static void main(String[] args) {
        Deque<Integer> stack = new ArrayDeque<>();
        stack.push(1);
        stack.push(2);
        Queue<String> q = new LinkedList<>();
        q.add("first");
        q.add("second");
        List<Integer> nums = List.of(1, 2, 3);
        nums.forEach(n -> {
            int sq = n * n;
            System.out.println(sq);
        });
    }
}` },
  { group: "Strings", name: "StringBuilder reverse", stdin: "", code: `public class Main {
    public static void main(String[] args) {
        String word = "java";
        StringBuilder sb = new StringBuilder();
        for (int i = word.length() - 1; i >= 0; i--) {
            sb.append(word.charAt(i));
        }
        System.out.println(sb);
    }
}` },
  { group: "Exceptions", name: "try / catch / crash", stdin: "", code: `public class Main {
    static int divide(int a, int b) {
        return a / b;
    }
    public static void main(String[] args) {
        try {
            divide(10, 0);
        } catch (ArithmeticException e) {
            System.out.println("Caught: divide by zero");
        }
        int[] data = new int[3];
        data[5] = 1;
    }
}` },
];

export const guessFileName = (code: string): string => {
  const pub = /public\s+(?:final\s+|abstract\s+)*(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/.exec(code);
  if (pub) return `${pub[1]}.java`;
  const main = /class\s+([A-Za-z_]\w*)[^{]*\{(?:[^{}]|\{[^{}]*\})*static\s+void\s+main/.exec(code);
  return `${main?.[1] ?? "Main"}.java`;
};
