const http = require('http');

const samplePred = {
  inventoryItemId: "INV-001",
  medicine: "Amoxicillin 500mg",
  batch: "AM-882",
  currentStockKg: 0.7,
  minThresholdKg: 1.2,
  consumptionRate: 0.0063,
  hoursToZero: 111.1,
  hoursToThreshold: 0,
  deficitKg: 1.1,
  urgency: "LOW"
};

const data = JSON.stringify({ prediction: samplePred });

const req = http.request('http://localhost:5000/api/ai/explain', {
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
    console.log('BODY:', body);
  });
});

req.on('error', err => console.error('ERR:', err.message));
req.write(data);
req.end();
