/**
 * MediLink AI — UDP Auto-Discovery & Zero-Config LAN Beacon
 * 
 * Allows ESP32-CAM and other IoT nodes to discover the MediLink backend
 * on the local network automatically without any hardcoded IP addresses
 * or temporary cloud tunnels.
 */

const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 5055;
const BROADCAST_ADDR = '255.255.255.255';
let serverSocket = null;
let beaconInterval = null;

/**
 * Returns the best local IPv4 address of this machine (excluding loopback).
 */
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  let candidate = '127.0.0.1';

  // 1. First priority: Physical Wi-Fi or Wireless adapters
  for (const name of Object.keys(interfaces)) {
    const isVirtual = /virtual|vbox|vmware|vethernet|hyper-v|loopback/i.test(name);
    const isWifi = /wi-?fi|wireless|wlan/i.test(name);
    if (isWifi && !isVirtual) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  }

  // 2. Second priority: Physical Ethernet adapters (non-virtual, exclude 192.168.56.x VirtualBox)
  for (const name of Object.keys(interfaces)) {
    const isVirtual = /virtual|vbox|vmware|vethernet|hyper-v|loopback/i.test(name);
    if (!isVirtual) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('192.168.56.')) {
          return iface.address;
        }
      }
    }
  }

  // 3. Fallback to any non-internal IPv4
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        candidate = iface.address;
      }
    }
  }
  return candidate;
}

/**
 * Starts the UDP discovery service.
 * @param {number} apiPort - Express API port (default 5000)
 */
function startDiscovery(apiPort = 5000) {
  if (serverSocket) return; // already running

  serverSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

  serverSocket.on('error', (err) => {
    console.warn('[UDP Discovery] Socket error:', err.message);
  });

  serverSocket.on('message', (msg, rinfo) => {
    const text = msg.toString().trim();
    if (text.includes('MEDILINK_DISCOVER') || text.includes('WHERE_IS_MEDILINK')) {
      const localIp = getLocalIp();
      const payload = JSON.stringify({
        service: 'medilink',
        status: 'ONLINE',
        serverIp: localIp,
        port: apiPort,
        uploadUrl: `http://${localIp}:${apiPort}/api/upload`,
        timestamp: Date.now()
      });

      const responseBuffer = Buffer.from(payload);
      serverSocket.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address, (err) => {
        if (err) {
          console.warn(`[UDP Discovery] Failed to send ACK to ${rinfo.address}:${rinfo.port}:`, err.message);
        } else {
          console.log(`[UDP Discovery 📡] Handshake with ESP32 at ${rinfo.address} ➔ Sent Endpoint: http://${localIp}:${apiPort}/api/upload`);
        }
      });
    }
  });

  serverSocket.bind(DISCOVERY_PORT, () => {
    try {
      serverSocket.setBroadcast(true);
    } catch (e) {}
    console.log(`[UDP Discovery 📡] Active on port ${DISCOVERY_PORT} (Zero-Config Auto-Pairing Ready)`);

    // Broadcast heartbeat beacon every 3 seconds so listening ESP32s detect immediately
    beaconInterval = setInterval(() => {
      if (!serverSocket) return;
      const localIp = getLocalIp();
      const beaconPayload = Buffer.from(JSON.stringify({
        service: 'medilink',
        serverIp: localIp,
        port: apiPort,
        uploadUrl: `http://${localIp}:${apiPort}/api/upload`
      }));

      serverSocket.send(beaconPayload, 0, beaconPayload.length, DISCOVERY_PORT, BROADCAST_ADDR, () => {});
    }, 3000);
  });
}

function stopDiscovery() {
  if (beaconInterval) {
    clearInterval(beaconInterval);
    beaconInterval = null;
  }
  if (serverSocket) {
    try { serverSocket.close(); } catch (e) {}
    serverSocket = null;
  }
}

module.exports = {
  startDiscovery,
  stopDiscovery,
  getLocalIp,
  DISCOVERY_PORT
};
