const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 Starting Persistent ESP32 Tunnel Monitor...');

function startTunnel() {
  const tunnel = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-o', 'ServerAliveInterval=30', '-R', '80:localhost:5000', 'nokey@localhost.run'], {
    shell: true
  });

  tunnel.stdout.on('data', (data) => {
    const text = data.toString();
    console.log('[TUNNEL OUTPUT]', text);
    const match = text.match(/https:\/\/[a-z0-9]+\.lhr\.life/i);
    if (match) {
      const url = match[0] + '/api/upload';
      console.log('\n======================================================');
      console.log('📌 ACTIVE ESP32 UPLOAD LINK:', url);
      console.log('======================================================\n');
      fs.writeFileSync('./current_tunnel_url.txt', url);
    }
  });

  tunnel.stderr.on('data', (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-z0-9]+\.lhr\.life/i);
    if (match) {
      const url = match[0] + '/api/upload';
      console.log('\n======================================================');
      console.log('📌 ACTIVE ESP32 UPLOAD LINK:', url);
      console.log('======================================================\n');
      fs.writeFileSync('./current_tunnel_url.txt', url);
    }
  });

  tunnel.on('close', (code) => {
    console.warn(`⚠️ Tunnel SSH connection closed (code ${code}). Auto-reconnecting in 3 seconds...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();
