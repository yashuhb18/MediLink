require('dotenv').config();
const { connectMongoDB } = require('./src/config/mongodb');

async function test() {
  await connectMongoDB();
  const Predictor = require('./src/modules/predictor');
  try {
    const preds = await Predictor.generatePredictions('H01');
    console.log('✅ PREDICTIONS SUCCESS! Count:', preds.length);
    console.log('Sample Prediction:', preds[0] ? preds[0].medicine : 'None');
    process.exit(0);
  } catch (err) {
    console.error('❌ PREDICTOR ERROR:', err);
    process.exit(1);
  }
}

test();
