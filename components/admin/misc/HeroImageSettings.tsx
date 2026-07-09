'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, RotateCcw, Save } from '@deemlol/next-icons';

import toast from '@/lib/utils/toast';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import ConfirmationModal from '@/components/ui/ConfirmationModal';

interface HeroImageSettingsProps {
  /** Current custom hero image path, or null when the bundled default is in use. */
  initialHeroImage: string | null;
}

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_SIZE_BYTES = 8 * 1024 * 1024;

/**
 * Admin control for the homepage hero image.
 * Lets an admin upload a custom photo (stored under public/uploads) or restore
 * the bundled default. The image is shown on the right of the homepage in a
 * tall, roughly vertical frame, so the preview mirrors that aspect ratio.
 */
export default function HeroImageSettings({ initialHeroImage }: HeroImageSettingsProps) {
  const [currentImage, setCurrentImage] = useState<string | null>(initialHeroImage);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED.split(',').includes(file.type)) {
      toast('Format non supporté. Utilisez JPEG, PNG ou WebP.', 'error');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast("L'image ne doit pas dépasser 8 Mo", 'error');
      return;
    }

    // Revoke any previous object URL before creating a new one.
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetchWithAuth('/api/admin/hero-image', {
        method: 'POST',
        body: formData,
        // Let the browser set multipart boundaries.
        _contentType: null,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Échec de l'envoi");
      }

      setCurrentImage(data.url);
      clearSelection();
      toast("Photo d'accueil mise à jour", 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const confirmReset = async () => {
    setResetConfirmOpen(false);
    setResetting(true);
    try {
      const res = await fetchWithAuth('/api/admin/hero-image', { method: 'DELETE' });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Échec de la réinitialisation');
      }

      setCurrentImage(null);
      clearSelection();
      toast("Photo d'accueil réinitialisée", 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(message, 'error');
    } finally {
      setResetting(false);
    }
  };

  const displayedImage = previewUrl || currentImage;

  return (
    <div className="bg-white border border-gray-200 overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
        <h2 className="font-poppins font-semibold text-gray-900">Photo d&apos;accueil</h2>
        <p className="text-sm text-gray-500">
          Image affichée à droite de la page d&apos;accueil (format vertical)
        </p>
      </div>

      <div className="px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Preview */}
          <div className="shrink-0">
            <div className="relative w-40 h-56 border border-gray-200 bg-gray-50 overflow-hidden">
              {displayedImage ? (
                <Image
                  src={displayedImage}
                  alt="Aperçu de la photo d'accueil"
                  className="object-cover"
                  fill
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-xs text-gray-400 px-2">
                  Image par défaut du site
                </div>
              )}
            </div>
            {previewUrl && (
              <p className="mt-2 text-xs text-gray-500 text-center">Aperçu (non enregistré)</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex-1 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:border-0 file:bg-black file:text-white file:font-poppins file:text-sm file:cursor-pointer hover:file:bg-gray-800"
            />
            <p className="text-xs text-gray-500">
              Formats acceptés : JPEG, PNG, WebP — 8 Mo maximum.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-poppins font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploading ? <Save className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                {uploading ? 'Envoi...' : 'Enregistrer la photo'}
              </button>

              {selectedFile && !uploading && (
                <button
                  onClick={clearSelection}
                  className="px-4 py-2 border border-gray-300 text-sm font-poppins font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Annuler
                </button>
              )}

              {currentImage && (
                <button
                  onClick={() => setResetConfirmOpen(true)}
                  disabled={resetting}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-sm font-poppins font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" />
                  {resetting ? 'Réinitialisation...' : 'Image par défaut'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal
        open={resetConfirmOpen}
        title="Réinitialiser la photo d'accueil"
        description="Êtes-vous sûr de vouloir restaurer l'image par défaut du site ? La photo actuelle sera supprimée."
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={confirmReset}
      />
    </div>
  );
}
