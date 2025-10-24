const { execSync } = require('child_process');

console.log('Installing dependencies...');

try {
  // Install frontend dependencies
  console.log('Installing frontend dependencies...');
  execSync('npm install react-hook-form @hookform/resolvers zod @radix-ui/react-label @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react next-themes', { 
    cwd: process.cwd(),
    stdio: 'inherit' 
  });

  // Install API dependencies
  console.log('Installing API dependencies...');
  execSync('npm install next-auth @prisma/client uuid @types/uuid', { 
    cwd: process.cwd(),
    stdio: 'inherit' 
  });

  console.log('\n✅ Dependencies installed successfully!');
} catch (error) {
  console.error('\n❌ Error installing dependencies:', error.message);
  process.exit(1);
}
