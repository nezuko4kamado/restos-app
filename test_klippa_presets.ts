// Test script to verify Klippa DocHorizon API Key
const KLIPPA_API_KEY = Deno.env.get('KLIPPA_API_KEY') || 'YOUR_API_KEY_HERE';
const KLIPPA_PRESETS_URL = 'https://dochorizon.klippa.com/api/services/document_capturing/v1/financial/presets';

console.log('🔍 Testing Klippa DocHorizon API Key...');
console.log('📋 API Key (first 20 chars):', KLIPPA_API_KEY.substring(0, 20) + '...');

try {
  const response = await fetch(KLIPPA_PRESETS_URL, {
    method: 'GET',
    headers: {
      'x-api-key': KLIPPA_API_KEY
    }
  });

  console.log('📊 Response Status:', response.status);
  console.log('📊 Response Status Text:', response.statusText);

  const data = await response.text();
  console.log('📋 Response Body:', data);

  if (response.ok) {
    console.log('✅ SUCCESS! API Key is valid for DocHorizon Financial');
    const jsonData = JSON.parse(data);
    console.log('📋 Available Presets:', JSON.stringify(jsonData, null, 2));
  } else {
    console.log('❌ FAILED! API Key is not valid for DocHorizon Financial');
    console.log('💡 You may need to request a DocHorizon-specific API key from Klippa');
  }
} catch (error) {
  console.log('❌ ERROR:', error.message);
}
