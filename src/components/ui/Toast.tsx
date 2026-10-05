"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "@/components/Icon";
import { blockIfPlanExpired } from "@/lib/plan-expired-client";

export type ToastTone = "success" | "error" | "info" | "loading";

type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
};

type ToastApi = {
  push: (input: { tone: ToastTone; title: string; detail?: string; durationMs?: number }) => string;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  loading: (title: string, detail?: string) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

let toastSeq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (input: { tone: ToastTone; title: string; detail?: string; durationMs?: number }) => {
      const id = `toast-${++toastSeq}`;
      setItems((prev) => [...prev.slice(-4), { id, tone: input.tone, title: input.title, detail: input.detail }]);
      const duration =
        input.durationMs ??
        (input.tone === "loading" ? 0 : input.tone === "error" ? 5200 : 3200);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (title, detail) => {
        push({ tone: "success", title, detail });
      },
      error: (title, detail) => {
        if (detail === "NEXT_REDIRECT" && blockIfPlanExpired()) return;
        push({ tone: "error", title, detail });
      },
      info: (title, detail) => {
        push({ tone: "info", title, detail });
      },
      loading: (title, detail) => push({ tone: "loading", title, detail, durationMs: 0 }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-relevant="additions">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.tone}`} role={item.tone === "error" ? "alert" : "status"}>
            <span className="toast-icon" aria-hidden>
              <Icon
                name={
                  item.tone === "success"
                    ? "check"
                    : item.tone === "error"
                      ? "alert"
                      : item.tone === "loading"
                        ? "refresh"
                        : "bell"
                }
                size={16}
              />
            </span>
            <div className="toast-body">
              <strong>{item.title}</strong>
              {item.detail ? <span>{item.detail}</span> : null}
            </div>
            {item.tone !== "loading" ? (
              <button type="button" className="toast-close" aria-label="Fermer" onClick={() => dismiss(item.id)}>
                ×
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function useToastOptional() {
  return useContext(ToastContext);
}
