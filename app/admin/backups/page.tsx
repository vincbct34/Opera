import AdminBackupClient from '@/components/admin/misc/AdminBackupClient';
import { listBackups } from '@/lib/backup/backupService';

// Force dynamic rendering - backup data is real-time
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminBackupsPage() {
  const backups = await listBackups();

  return <AdminBackupClient initialBackups={backups} />;
}
