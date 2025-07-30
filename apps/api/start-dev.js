const { spawn } = require('child_process');
const path = require('path');

// Set up environment
process.env.NODE_ENV = 'development';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/oasis_dev';

// Run TypeScript directly with ts-node
const tsNode = spawn('npx', ['ts-node', 'src/main.ts'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    TS_NODE_PROJECT: path.join(__dirname, 'tsconfig.json'),
    TS_NODE_TRANSPILE_ONLY: 'true',
  }
});

tsNode.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

tsNode.on('exit', (code) => {
  process.exit(code);
});
