// Test script per verificare la NUOVA configurazione Mindee
console.log('🔍 MINDEE NEW API KEY TEST');
console.log('=====================================');

// NUOVA API key
const apiKey = 'md_hCVaEqAc3CF5NBNUvtVTCgWizXf6BFBuJ4DopmvtvAI';
console.log('🔑 NEW API Key:', apiKey.substring(0, 10) + '...');
console.log('🔑 API Key length:', apiKey.length);
console.log('🔑 API Key starts with md_:', apiKey.startsWith('md_'));

// Test endpoints
const endpoints = [
  'https://api.mindee.net/v1/products/mindee/invoices/v4/predict',  // US
];

async function testEndpoint(endpoint) {
  console.log(`\n🌐 Testing endpoint: ${endpoint}`);
  
  try {
    // Create a minimal test request (without actual file)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({}) // Empty body to test auth
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      console.log('❌ 401 Unauthorized - API key issue or wrong region');
    } else if (response.status === 400) {
      console.log('✅ 400 Bad Request - Auth OK, but missing document (expected)');
    } else if (response.status === 404) {
      console.log('❌ 404 Not Found - Endpoint does not exist');
    } else {
      console.log(`ℹ️ Status: ${response.status}`);
    }
    
    const responseText = await response.text();
    console.log('📄 Response preview:', responseText.substring(0, 300) + '...');
    
    return response.status;
    
  } catch (error) {
    console.log('❌ Network error:', error.message);
    return null;
  }
}

// Test with actual FormData (closer to real usage)
async function testWithFormData(endpoint) {
  console.log(`\n📄 Testing with FormData: ${endpoint}`);
  
  try {
    // Create minimal FormData
    const formData = new FormData();
    // Add empty blob to test format
    const emptyBlob = new Blob([''], { type: 'image/jpeg' });
    formData.append('document', emptyBlob, 'test.jpg');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        // Don't set Content-Type for FormData
      },
      body: formData
    });
    
    console.log(`📡 FormData Response: ${response.status} ${response.statusText}`);
    
    if (response.status === 400) {
      console.log('✅ 400 - Auth working, document format issue (expected)');
    } else if (response.status === 401) {
      console.log('❌ 401 - Auth failed');
    } else {
      console.log(`ℹ️ Status: ${response.status}`);
    }
    
    const responseText = await response.text();
    console.log('📄 FormData Response preview:', responseText.substring(0, 300) + '...');
    
    return response.status;
    
  } catch (error) {
    console.log('❌ FormData error:', error.message);
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting API key validation tests...\n');
  
  for (const endpoint of endpoints) {
    const jsonStatus = await testEndpoint(endpoint);
    const formStatus = await testWithFormData(endpoint);
    
    console.log(`\n📊 Summary for ${endpoint}:`);
    console.log(`   JSON test: ${jsonStatus}`);
    console.log(`   FormData test: ${formStatus}`);
    
    if (jsonStatus === 400 || formStatus === 400) {
      console.log('✅ API KEY WORKING! (400 = auth OK, missing proper document)');
    } else if (jsonStatus === 401 || formStatus === 401) {
      console.log('❌ API KEY FAILED! (401 = unauthorized)');
    }
  }
  
  console.log('\n🏁 Test completed!');
  console.log('💡 Next: Deploy Edge Function with new API key');
}

runTests();