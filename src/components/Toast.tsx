import { useEffect, useState } from 'react';

interface ToastMsg {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let listeners: ((msg: ToastMsg) => void)[] = [];
let nextId = 0;

export function showToast(message: string, type: ToastMsg['type'] = 'info') {
  const msg: ToastMsg = { id: nextId++, message, type };
  listeners.forEach((fn) => fn(msg));
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMsg) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 2500);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter((l) => l !== handler);
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} role="status" aria-live="polite">
          {t.message}
        </div>
      ))}
    </div>
  );
}
