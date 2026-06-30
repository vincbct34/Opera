import { showToast } from '@/components/ui/Toast';

/**
 * Display a toast notification.
 * @param message - The message to display.
 * @param type - The type of toast (info, success, error). Default is 'info'.
 */
export default function toast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  showToast(message, type);
}
