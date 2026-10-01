import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export type ToastKind = 'info' | 'success' | 'error';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue>({ notify: () => undefined });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

const KIND_STYLES: Record<ToastKind, string> = {
  info: 'border-white/15 text-zinc-200',
  success: 'border-terminal-green/40 text-terminal-green',
  error: 'border-red-500/40 text-red-400',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(1);

  const notify = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = idRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed top-16 right-4 z-[200] flex flex-col gap-2 max-w-sm w-[calc(100vw-2rem)]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bg-zinc-950 border ${KIND_STYLES[t.kind]} rounded-lg px-4 py-3 text-xs font-medium shadow-2xl toast-slide-in`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
