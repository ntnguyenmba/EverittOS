const STACK_KEY = 'everittos:nav-stack';
const MAX_STACK = 30;

/** Paths that should never appear as a back destination. */
const NON_BACK_PREFIXES = [
  '/login',
  '/signup',
  '/reset-password',
  '/forgot-password',
  '/auth'
];

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

function isNonBackPath(path: string): boolean {
  return NON_BACK_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isValidBackTarget(path: string, currentPath: string): boolean {
  if (!isSafeInternalPath(path)) return false;
  if (path === currentPath) return false;
  if (isNonBackPath(path)) return false;
  return true;
}

function findPreviousTarget(stack: string[], currentPath: string): string | null {
  const working = [...stack];
  while (working.length >= 2) {
    working.pop();
    const previous = working[working.length - 1];
    if (previous && isValidBackTarget(previous, currentPath)) {
      return previous;
    }
  }
  return null;
}

function stackForPreviousTarget(stack: string[], currentPath: string): { previous: string; nextStack: string[] } | null {
  const working = [...stack];
  while (working.length >= 2) {
    working.pop();
    const previous = working[working.length - 1];
    if (previous && isValidBackTarget(previous, currentPath)) {
      return { previous, nextStack: working };
    }
  }
  return null;
}

/** Whether the back button should appear for the current page. */
export function hasAppBackTarget(currentPath: string, fallback: string): boolean {
  if (typeof window === 'undefined') return false;

  const stack = readStack();
  if (findPreviousTarget(stack, currentPath)) return true;

  return isValidBackTarget(fallback, currentPath);
}

/** Record in-app route changes for safe back navigation. */
export function recordAppNavigation(pathname: string): void {
  if (typeof window === 'undefined' || !isSafeInternalPath(pathname)) return;
  if (isNonBackPath(pathname)) return;

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
export function navigateAppBack(router: AppRouter, fallback: string, currentPath?: string): void {
  if (typeof window === 'undefined') {
    router.push(fallback);
    return;
  }

  const current = currentPath || window.location.pathname;
  const stack = readStack();
  const target = stackForPreviousTarget(stack, current);

  if (target) {
    writeStack(target.nextStack);
    router.push(target.previous);
    return;
  }

  if (isValidBackTarget(fallback, current)) {
    router.push(fallback);
  }
}
