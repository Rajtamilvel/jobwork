const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

console.log('\x1b[36m%s\x1b[0m', '=====================================================');
console.log('\x1b[36m%s\x1b[0m', '   ⚙️  MACHINAWORK PRO - JOBWORK ENGINEER OS  ⚙️');
console.log('\x1b[36m%s\x1b[0m', '=====================================================');

// 1. Start Python FastAPI Backend
console.log('\x1b[33m%s\x1b[0m', '▶ [Backend] Booting Python FastAPI server on http://127.0.0.1:8000 ...');
const pythonProcess = spawn('python', ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000', '--app-dir', 'backend', '--reload'], {
  stdio: 'inherit',
  shell: true
});

pythonProcess.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `[Backend Error] Failed to start Python backend: ${err.message}`);
});

// 2. Start React + Vite Client
console.log('\x1b[32m%s\x1b[0m', '▶ [Frontend] Booting React + Tailwind frontend on http://localhost:5173 ...');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const clientProcess = spawn(npmCmd, ['run', 'dev'], {
  cwd: path.join(__dirname, 'client'),
  stdio: 'inherit',
  shell: true
});

clientProcess.on('error', (err) => {
  console.error('\x1b[31m%s\x1b[0m', `[Frontend Error] Failed to start client: ${err.message}`);
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n\x1b[33m%s\x1b[0m', 'Shutting down Jobwork Engineer servers...');
  pythonProcess.kill();
  clientProcess.kill();
  process.exit(0);
});
