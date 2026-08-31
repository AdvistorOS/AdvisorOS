"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type Toast = { id: number; message: string; type: "success" | "error" };
const ToastContext = createContext<(message: string, type?: "success" | "error") => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center">
        {toasts.map((t) => (
          <div key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg card-shadow text-sm font-medium animate-[fadeIn_0.2s_ease]
              ${t.type === "success" ? "bg-ink text-paper" : "bg-warn text-paper"}`}>
            {t.type === "success" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
