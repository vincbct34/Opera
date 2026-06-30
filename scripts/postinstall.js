import { execSync } from 'child_process';

try {
  // Run db push
  console.log('Running prisma db push...');
  execSync('npx prisma db push', { stdio: 'inherit' });

  // Prisma v7 ships a Rust-free client; there is no engine to exclude
  // (the v6 `--no-engine` flag was removed).
  console.log('Running prisma generate...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  console.log('Postinstall completed successfully!');
} catch (error) {
  console.error('Postinstall failed:', error.message);
  process.exit(1);
}
