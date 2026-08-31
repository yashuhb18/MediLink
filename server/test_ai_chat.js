const http = require('http');

const data = JSON.stringify({
  message: 'Which medicine is at the highest risk of shortage right now in Apollo Hospital H01?',
  hospitalId: 'H01',
  role: 'REQUESTING_SUPERVISOR'
});

const req = http.request('http://localhost:5000/api/ai/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('REPLY:', JSON.parse(body));
  });
});

req.on('error', err => console.error('ERR:', err.message));
req.write(data);
req.end();
