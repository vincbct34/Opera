'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Save, RotateCcw, Link as LinkIcon } from '@deemlol/next-icons';

import toast from '@/lib/utils/toast';
import { fetchWithAuth } from '@/lib/api/fetchWithAuth';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { validateHeroImageUrl, HERO_IMAGE_DOMAIN } from '@/lib/config/heroImageUrl';

interface HeroImageSettingsProps {
  /** Current custom hero image URL, or null when the bundled default is in use. */
  initialHeroImage: string | null;
}

/**
 * Admin control for the homepage hero image.
 * Lets an admin point the hero to an external image URL (which must be hosted on
 * the Opera domain or a subdomain) or restore the bundled default. The image is
 * shown on the right of the homepage in a tall, roughly vertical frame, so the
 * preview mirrors that aspect ratio.
 */
export default function HeroImageSettings({ initialHeroImage }: HeroImageSettingsProps) {
  const [currentImage, setCurrentImage] = useState<string | null>(initialHeroImage);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Live preview only for a valid URL, so we never point next/image at junk.
  const validation = url.trim() ? validateHeroImageUrl(url) : null;
  const previewUrl = validation && 'url' in validation ? validation.url : null;
  const displayedImage = previewUrl || currentImage;

  const handleSave = async () => {
    const result = validateHeroImageUrl(url);
    if ('error' in result) {
      toast(result.error, 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/admin/hero-image', {
        method: 'POST',
        body: JSON.stringify({ url: result.url }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Échec de l'enregistrement");
      }

      setCurrentImage(data.url);
      setUrl('');
      toast("Photo d'accueil mise à jour", 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(message, 'error');
    } finally {
      setSaving(false);
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
      setUrl('');
      toast("Photo d'accueil réinitialisée", 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      toast(message, 'error');
    } finally {
      setResetting(false);
    }
  };

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
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                inputMode="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={`https://${HERO_IMAGE_DOMAIN}/...`}
                className="block w-full pl-9 pr-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
            <p className="text-xs text-gray-500">
              URL d&apos;une image hébergée sur {HERO_IMAGE_DOMAIN} ou un de ses sous-domaines
              (HTTPS).
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={!url.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-poppins font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer la photo'}
              </button>

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
        description="Êtes-vous sûr de vouloir restaurer l'image par défaut du site ? L'URL actuelle sera supprimée."
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={confirmReset}
      />
    </div>
  );
}
