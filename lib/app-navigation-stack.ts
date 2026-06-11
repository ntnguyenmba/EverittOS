const STACK_KEY = 'everittos:nav-stack';
const MAX_STACK = 30;

function readStack(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(STACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(STACK_KEY, JSON.stringify(stack.slice(-MAX_STACK)));
}

export function isSafeInternalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

/** Record in-app route changes for safe back navigation. */
export function recordAppNavigation(pathname: string): void {
  if (typeof window === 'undefined' || !isSafeInternalPath(pathname)) return;

  const stack = readStack();
  const last = stack[stack.length - 1];
  if (last === pathname) return;

  const existingIndex = stack.lastIndexOf(pathname);
  if (existingIndex >= 0 && existingIndex < stack.length - 1) {
    writeStack(stack.slice(0, existingIndex + 1));
    return;
  }

  stack.push(pathname);
  writeStack(stack);
}

type AppRouter = {
  push: (href: string) => void;
};

/** Navigate to the previous in-app page, or a safe dashboard fallback. */
export function navigateAppBack(router: AppRouter, fallback: string): void {
  if (typeof window === 'undefined') {
    router.push(fallback);
    return;
  }

  const stack = readStack();
  if (stack.length >= 2) {
    stack.pop();
    const previous = stack[stack.length - 1];
    if (previous && isSafeInternalPath(previous)) {
      writeStack(stack);
      router.push(previous);
      return;
    }
  }

  router.push(fallback);
}
