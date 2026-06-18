import { useState, useCallback, useRef } from "react";

type ToastType = { message: string; type: "success" | "error" } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastType>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ message, type });
    timerRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  return { toast, showToast };
}
