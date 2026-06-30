'use client';

import { useEffect } from 'react';

/**
 * Props for the ConfirmationModal component.
 */
type Props = {
  open: boolean;
  title?: string;
  description?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * A generic modal for confirming actions.
 * Displays a title, description, and confirm/cancel buttons.
 */
export default function ConfirmationModal({
  open,
  title = 'Confirmer',
  description = 'Êtes-vous sûr ?',
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 w-full max-w-md rounded">
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-sm text-gray-700 mb-4">{description}</p>
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 cursor-pointer" onClick={onCancel}>
            Annuler
          </button>
          <button className="px-4 py-2 bg-red-600 text-white cursor-pointer" onClick={onConfirm}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
