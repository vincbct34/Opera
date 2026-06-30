type Toast = { id: number; message: string; type?: 'info' | 'success' | 'error' };

export const toastSubscribers = new Set<(t: Toast[]) => void>();
let toasts: Toast[] = [];
let nextId = 1;

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const toast: Toast = { id: nextId++, message, type };
  toasts = [...toasts, toast];
  toastSubscribers.forEach((s) => s(toasts));
}

const ToastContainer = () => null;
export default ToastContainer;
