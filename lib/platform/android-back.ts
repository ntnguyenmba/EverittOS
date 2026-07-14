type AndroidBackHandler = {
  id: string;
  priority: number;
  handle: () => boolean;
};

const handlers: AndroidBackHandler[] = [];

export function registerAndroidBackHandler(handler: AndroidBackHandler): () => void {
  handlers.push(handler);
  handlers.sort((a, b) => b.priority - a.priority);

  return () => {
    const index = handlers.findIndex((item) => item.id === handler.id);
    if (index >= 0) handlers.splice(index, 1);
  };
}

/** Returns true when a handler consumed the back press. */
export function dispatchAndroidBackPress(): boolean {
  for (const handler of handlers) {
    if (handler.handle()) return true;
  }
  return false;
}
