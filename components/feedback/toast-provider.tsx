'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { createPortal } from 'react-dom';

export type ToastKind = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  createdAt: number;
};

type PushToastInput = {
  kind: ToastKind;
  message: string;
  durationMs?: number;
};

type ToastContextValue = {
  push: (input: PushToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION: Record<ToastKind, number> = {
  success: 4200,
  error: 6400,
  info: 4800
};

const MAX_TOASTS = 4;

function toastTitle(kind: ToastKind): string {
  if (kind === 'success') return 'Success';
  if (kind === 'error') return 'Error';
  return 'Notice';
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setMounted(true);
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    ({ kind, message, durationMs }: PushToastInput) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: ToastItem = { id, kind, message: message.trim(), createdAt: Date.now() };

      setToasts((current) => [toast, ...current].slice(0, MAX_TOASTS));

      const timer = setTimeout(() => dismiss(id), durationMs ?? DEFAULT_DURATION[kind]);
      timersRef.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  const portal =
    mounted && toasts.length > 0
      ? createPortal(
          <div className="app-toast-stack" aria-live="polite" aria-relevant="additions text">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`app-toast app-toast-${toast.kind}`}
                role={toast.kind === 'error' ? 'alert' : 'status'}
              >
                <div className="app-toast-accent" aria-hidden="true" />
                <div className="app-toast-body">
                  <strong className="app-toast-title">{toastTitle(toast.kind)}</strong>
                  <p className="app-toast-message">{toast.message}</p>
                </div>
                <button
                  type="button"
                  className="app-toast-dismiss"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(toast.id)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>,
          document.body
        )
      : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portal}
    </ToastContext.Provider>
  );
}

export function useToastContext(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToastContext must be used within ToastProvider');
  }
  return ctx;
}
