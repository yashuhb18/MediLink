const http = require('https');

const data = JSON.stringify({
  image_data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  source: 'ESP32-CAM'
});

const req = http.request('https://harold-minimum-val-poster.trycloudflare.com/api/upload', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('RESPONSE:', body);
  });
});

req.on('error', err => console.error('ERROR:', err.message));
req.write(data);
req.end();
