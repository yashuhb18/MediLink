const http = require('http');

const prompt = "You are MediBot, the AI Clinical Assistant for MediLink. Give a short 2-sentence response explaining how you predict stockouts.";

const postData = JSON.stringify({
  model: 'glm4',
  prompt: prompt,
  stream: false
});

const req = http.request('http://127.0.0.1:11434/api/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(body);
      console.log('✅ GLM-4 RESPONSE:');
      console.log(parsed.response);
    } catch (e) {
      console.error('Parse error:', e, body);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.write(postData);
req.end();
