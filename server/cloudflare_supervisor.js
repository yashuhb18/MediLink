const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
const infoFile = path.join(__dirname, 'active_tunnel.json');

console.log('🚀 Starting Cloudflare Enterprise Tunnel Supervisor...');

function startTunnel() {
  console.log('⚡ Launching cloudflared tunnel to http://localhost:5000...');
  const proc = spawn(cloudflaredPath, ['tunnel', '--url', 'http://localhost:5000'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  proc.stdout.on('data', data => handleOutput(data.toString()));
  proc.stderr.on('data', data => handleOutput(data.toString()));

  proc.on('close', code => {
    console.log(`⚠️ cloudflared process exited with code ${code}. Auto-restarting in 2 seconds...`);
    setTimeout(startTunnel, 2000);
  });

  proc.on('error', err => {
    console.error('❌ cloudflared process error:', err);
    setTimeout(startTunnel, 2000);
  });
}

function handleOutput(text) {
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
  if (match) {
    const url = match[0];
    const uploadUrl = `${url}/api/upload`;
    console.log('\n======================================================');
    console.log(`✅ PERMANENT CLOUDFLARE ESP32 UPLOAD LINK: ${uploadUrl}`);
    console.log('======================================================\n');
    
    fs.writeFileSync(infoFile, JSON.stringify({
      tunnelUrl: url,
      uploadUrl,
      updatedAt: new Date().toISOString()
    }, null, 2));
  }
}

startTunnel();
