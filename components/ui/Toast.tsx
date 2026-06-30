'use client';

import { useEffect, useState } from 'react';

type Toast = { id: number; message: string; type?: 'info' | 'success' | 'error' };

let nextId = 1;

export const toastSubscribers = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];

/**
 * showToast function
 * Triggers a toast notification.
 *
 * @param message - The message to display
 * @param type - The type of toast (info, success, error)
 */
export function showToast(message: string, type: Toast['type'] = 'info') {
  const toast: Toast = { id: nextId++, message, type };
  toasts = [...toasts, toast];
  toastSubscribers.forEach((s) => s(toasts));
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id);
    toastSubscribers.forEach((s) => s(toasts));
  }, 4000);
}

/**
 * ToastContainer component
 * Renders the list of active toast notifications.
 * Should be placed at the root of the application layout.
 */
export default function ToastContainer() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const sub = (t: Toast[]) => setItems(t);
    toastSubscribers.add(sub);
    return () => {
      toastSubscribers.delete(sub);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed right-4 bottom-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`px-4 py-2 rounded shadow ${t.type === 'error' ? 'bg-red-500 text-white' : t.type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
