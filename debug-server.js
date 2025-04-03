// Simple debug script to identify server startup issues
import { execSync, spawn } from 'child_process';

console.log('--- DEBUG SERVER STARTUP ---');

try {
  console.log('Checking for running processes on port 3000:');
  try {
    const output = execSync('lsof -i:3000 -P -n -t', { encoding: 'utf-8' }).trim();
    console.log(`Processes using port 3000: ${output || 'None'}`);
    
    if (output) {
      console.log('Process details:');
      console.log(execSync(`ps -p ${output.split('\n').join(',')} -o pid,ppid,comm,args`, { encoding: 'utf-8' }));
    }
  } catch (e) {
    console.log('No processes running on port 3000');
  }
  
  // Launch server with debug logging
  console.log('\nStarting server with debug logging...');
  const server = spawn('npx', ['tsx', 'server/index.ts'], {
    env: { ...process.env, DEBUG: '*', NODE_ENV: 'development' }
  });
  
  server.stdout.on('data', (data) => {
    console.log(`[SERVER]: ${data.toString().trim()}`);
  });
  
  server.stderr.on('data', (data) => {
    console.error(`[SERVER ERROR]: ${data.toString().trim()}`);
  });
  
  server.on('close', (code) => {
    console.log(`\nServer process exited with code ${code}`);
  });
  
  // Kill the process after 30 seconds
  setTimeout(() => {
    console.log('\nTimeout reached, killing debug server...');
    server.kill();
  }, 30000);
} catch (error) {
  console.error('Debug script error:', error);
}