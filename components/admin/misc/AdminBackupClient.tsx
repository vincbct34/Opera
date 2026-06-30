'use client';

import { useUser } from '@/context/UserContext';
import Loader from '@/components/ui/Loader';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { fetchJsonWithAuth, fetchWithAuth } from '@/lib/api/fetchWithAuth';
import toast from '@/lib/utils/toast';
import type { BackupInfo, BackupComparison, TableDiff } from '@/lib/backup/backupService';
import { Database, RefreshCw, AlertTriangle } from '@deemlol/next-icons';
import { HelpWidget } from '@/components/ui/HelpWidget';
import { HELP_CONTENTS } from '@/lib/help/helpContents';

type AdminBackupClientProps = {
  initialBackups: BackupInfo[];
};

/**
 * AdminBackupClient component to manage database backups
 * Provides listing, comparison, and restore functionality
 */
export default function AdminBackupClient({ initialBackups }: AdminBackupClientProps) {
  const { user, loading } = useUser();
  const router = useRouter();
  const [backups, setBackups] = useState<BackupInfo[]>(initialBackups);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Comparison state
  const [comparison, setComparison] = useState<BackupComparison | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // Restore state
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Redirect non-admin users
  useEffect(() => {
    if (!loading && (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN'))) {
      router.push('/');
    }
  }, [user, loading, router]);

  // Refresh backup list
  const refreshBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const { data, response } = await fetchJsonWithAuth<{
        success: boolean;
        backups: BackupInfo[];
      }>('/api/admin/backups');
      if (response.ok && data?.backups) {
        setBackups(data.backups);
      }
    } catch {
      toast('Erreur lors du chargement des backups', 'error');
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  // Create a new backup manually
  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const response = await fetchWithAuth('/api/admin/backups', {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast('Backup créée avec succès', 'success');
        await refreshBackups();
      } else {
        toast(data.error || 'Erreur lors de la création de la backup', 'error');
      }
    } catch {
      toast('Erreur lors de la création de la backup', 'error');
    } finally {
      setCreatingBackup(false);
    }
  };

  // Compare a backup with current DB
  const handleCompare = async (filename: string) => {
    setLoadingComparison(true);
    setComparison(null);
    try {
      const { data, response } = await fetchJsonWithAuth<{
        success: boolean;
        comparison: BackupComparison;
      }>(`/api/admin/backups/compare?filename=${encodeURIComponent(filename)}`);
      if (response.ok && data?.comparison) {
        setComparison(data.comparison);
      } else {
        toast('Erreur lors de la comparaison', 'error');
      }
    } catch {
      toast('Erreur lors de la comparaison', 'error');
    } finally {
      setLoadingComparison(false);
    }
  };

  // Handle restore
  const handleRestore = async (filename: string) => {
    if (confirmText !== 'RESTAURER') return;

    setRestoring(true);
    try {
      const response = await fetchWithAuth('/api/admin/backups/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast('Base de données restaurée avec succès', 'success');
        setRestoreTarget(null);
        setConfirmText('');
        await refreshBackups();
      } else {
        toast(data.error || 'Erreur lors de la restauration', 'error');
      }
    } catch {
      toast('Erreur lors de la restauration', 'error');
    } finally {
      setRestoring(false);
    }
  };

  // Format date
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Date invalide';
    return d.toLocaleString('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'medium',
    });
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  if (loading) {
    return (
      <main className="flex justify-center items-center h-[90vh]">
        <Loader />
      </main>
    );
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPERADMIN')) {
    return null;
  }

  return (
    <main className="p-4 sm:p-6">
      {/* Header */}
      <header className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-poppins font-semibold">
                Backups Base de Données
              </h1>
              <p className="mt-2 text-sm sm:text-base text-gray-700 font-ibm">
                Gérez les sauvegardes de la base de données, comparez et restaurez les données
              </p>
            </div>
            <div className="flex gap-3 self-start sm:self-auto">
              <button
                onClick={refreshBackups}
                disabled={loadingBackups}
                className="inline-flex items-center gap-2 px-4 py-2.5 border border-black text-black hover:bg-gray-50 transition-colors font-medium text-sm sm:text-base disabled:opacity-50"
              >
                <RefreshCw size={16} className={loadingBackups ? 'animate-spin' : ''} />
                <span>Rafraîchir</span>
              </button>
              <button
                onClick={handleCreateBackup}
                disabled={creatingBackup}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-black text-white hover:bg-gray-800 transition-colors font-medium text-sm sm:text-base whitespace-nowrap disabled:opacity-50"
              >
                {creatingBackup ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Database size={16} />
                )}
                <span>{creatingBackup ? 'Création...' : 'Nouvelle backup'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Backup List */}
      <section className="mb-6 sm:mb-8">
        <h2 className="text-xl font-poppins font-semibold mb-4">
          Backups disponibles ({backups.length})
        </h2>

        {loadingBackups ? (
          <div className="flex justify-center items-center py-12">
            <Loader />
          </div>
        ) : backups.length === 0 ? (
          <div className="bg-white border border-gray-200 shadow-sm p-6 sm:p-8 text-center">
            <Database size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="font-ibm text-sm text-gray-600">
              Aucune backup disponible. Créez votre première backup en cliquant sur le bouton
              ci-dessus.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                className="bg-white border border-gray-200 shadow-sm p-4 sm:p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-poppins font-semibold text-sm sm:text-base">
                      {backup.filename}
                    </h3>
                    <div className="flex flex-wrap gap-4 mt-1 font-ibm text-xs text-gray-600">
                      <span>{formatDate(backup.createdAt)}</span>
                      <span>{formatSize(backup.sizeBytes)}</span>
                      <span>{backup.tableCount} tables</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCompare(backup.filename)}
                      disabled={loadingComparison}
                      className="px-3 py-1.5 text-xs font-poppins font-semibold text-black border border-black hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      Comparer
                    </button>
                    <button
                      onClick={() => {
                        setRestoreTarget(backup.filename);
                        setConfirmText('');
                      }}
                      className="px-3 py-1.5 text-xs font-poppins font-semibold text-red-600 border border-red-600 hover:bg-red-50 transition-colors"
                    >
                      Restaurer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Comparison Result */}
      {loadingComparison && (
        <section className="mb-6 sm:mb-8">
          <div className="flex justify-center items-center py-12">
            <Loader />
          </div>
        </section>
      )}

      {comparison && !loadingComparison && (
        <ComparisonView comparison={comparison} onClose={() => setComparison(null)} />
      )}

      {/* Restore Confirmation Modal */}
      {restoreTarget && (
        <RestoreModal
          filename={restoreTarget}
          confirmText={confirmText}
          onConfirmTextChange={setConfirmText}
          onRestore={() => handleRestore(restoreTarget)}
          onCancel={() => {
            setRestoreTarget(null);
            setConfirmText('');
          }}
          restoring={restoring}
        />
      )}

      <HelpWidget content={HELP_CONTENTS['admin-backup']} isAdminPage={true} />
    </main>
  );
}

/** Comparison view component */
function ComparisonView({
  comparison,
  onClose,
}: {
  comparison: BackupComparison;
  onClose: () => void;
}) {
  const { summary, tables } = comparison;
  const hasChanges =
    summary.totalAdded > 0 || summary.totalRemoved > 0 || summary.totalModified > 0;

  // Format date
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Date invalide';
    return d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'medium' });
  };

  return (
    <section className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-poppins font-semibold">Comparaison : {comparison.filename}</h2>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-poppins font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Fermer
        </button>
      </div>

      <p className="font-ibm text-sm text-gray-600 mb-4">
        Backup du {formatDate(comparison.backupDate)} comparée à l&apos;état actuel de la base.
      </p>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-green-50 border border-green-200 p-4 text-center">
          <p className="text-2xl font-poppins font-bold text-green-700">{summary.totalAdded}</p>
          <p className="font-ibm text-xs text-green-600">Ajouts depuis la backup</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-4 text-center">
          <p className="text-2xl font-poppins font-bold text-red-700">{summary.totalRemoved}</p>
          <p className="font-ibm text-xs text-red-600">Suppressions depuis la backup</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 p-4 text-center">
          <p className="text-2xl font-poppins font-bold text-orange-700">{summary.totalModified}</p>
          <p className="font-ibm text-xs text-orange-600">Modifications depuis la backup</p>
        </div>
      </div>

      {!hasChanges ? (
        <div className="bg-green-50 border border-green-200 p-6 text-center">
          <p className="font-ibm text-sm text-green-700">
            ✓ La base de données est identique à la backup. Pas de différences détectées.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left p-3 font-poppins text-xs font-semibold text-gray-700">
                  Table
                </th>
                <th className="text-center p-3 font-poppins text-xs font-semibold text-gray-700">
                  Backup
                </th>
                <th className="text-center p-3 font-poppins text-xs font-semibold text-gray-700">
                  Actuel
                </th>
                <th className="text-center p-3 font-poppins text-xs font-semibold text-green-700">
                  Ajoutés
                </th>
                <th className="text-center p-3 font-poppins text-xs font-semibold text-red-700">
                  Supprimés
                </th>
                <th className="text-center p-3 font-poppins text-xs font-semibold text-orange-700">
                  Modifiés
                </th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => (
                <TableRow key={table.table} table={table} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Single table row in comparison view */
function TableRow({ table }: { table: TableDiff }) {
  const hasChanges = table.added > 0 || table.removed > 0 || table.modified > 0;

  return (
    <tr className={`border-b border-gray-100 ${hasChanges ? 'bg-yellow-50/30' : ''}`}>
      <td className="p-3 font-ibm text-sm font-medium">{table.table}</td>
      <td className="p-3 font-ibm text-sm text-center text-gray-600">{table.backupCount}</td>
      <td className="p-3 font-ibm text-sm text-center text-gray-600">{table.currentCount}</td>
      <td className="p-3 font-ibm text-sm text-center">
        {table.added > 0 ? (
          <span className="text-green-700 font-semibold">+{table.added}</span>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </td>
      <td className="p-3 font-ibm text-sm text-center">
        {table.removed > 0 ? (
          <span className="text-red-700 font-semibold">-{table.removed}</span>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </td>
      <td className="p-3 font-ibm text-sm text-center">
        {table.modified > 0 ? (
          <span className="text-orange-700 font-semibold">{table.modified}</span>
        ) : (
          <span className="text-gray-400">0</span>
        )}
      </td>
    </tr>
  );
}

/** Restore confirmation modal */
function RestoreModal({
  filename,
  confirmText,
  onConfirmTextChange,
  onRestore,
  onCancel,
  restoring,
}: {
  filename: string;
  confirmText: string;
  onConfirmTextChange: (text: string) => void;
  onRestore: () => void;
  onCancel: () => void;
  restoring: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white max-w-md w-full p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h3 className="text-lg font-poppins font-semibold">Confirmer la restauration</h3>
        </div>

        <div className="mb-4">
          <p className="font-ibm text-sm text-gray-700 mb-3">
            Vous êtes sur le point de restaurer la base de données depuis la backup :
          </p>
          <p className="font-poppins text-sm font-semibold bg-gray-100 p-2 break-all">{filename}</p>
        </div>

        <div className="bg-red-50 border border-red-200 p-3 mb-4">
          <p className="font-ibm text-xs text-red-700">
            <strong>⚠️ Attention :</strong> Cette action remplacera <strong>toutes</strong> les
            données de la base par celles de la backup. Une backup de sécurité sera créée
            automatiquement avant la restauration.
          </p>
        </div>

        <div className="mb-4">
          <label className="block font-ibm text-sm text-gray-700 mb-2">
            Tapez <strong>RESTAURER</strong> pour confirmer :
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder="RESTAURER"
            className="w-full px-3 py-2 border border-gray-300 text-sm font-ibm focus:outline-none focus:border-black"
            disabled={restoring}
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={restoring}
            className="px-4 py-2 text-sm font-poppins font-semibold text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={onRestore}
            disabled={confirmText !== 'RESTAURER' || restoring}
            className="px-4 py-2 text-sm font-poppins font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {restoring ? 'Restauration en cours...' : 'Restaurer la base'}
          </button>
        </div>
      </div>
    </div>
  );
}
