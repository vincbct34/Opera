import { execSync } from 'child_process';

const isProduction = process.env.NODE_ENV === 'production';

try {
  // Run db push
  console.log('Running prisma db push...');
  execSync('npx prisma db push', { stdio: 'inherit' });

  // Run prisma generate with or without --no-engine flag
  const generateCommand = isProduction ? 'npx prisma generate --no-engine' : 'npx prisma generate';

  console.log(`Running ${generateCommand}...`);
  execSync(generateCommand, { stdio: 'inherit' });

  console.log('Postinstall completed successfully!');
} catch (error) {
  console.error('Postinstall failed:', error.message);
  process.exit(1);
}
