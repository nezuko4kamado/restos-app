// Advanced Mindee API test - trying different endpoints and configurations
console.log('🔍 ADVANCED MINDEE API TEST');
console.log('=====================================');

const apiKey = 'md_hCVaEqAc3CF5NBNUvtVTCgWizXf6BFBuJ4DopmvtvAI';
const organization = 'salvatores-organization';
const modelId = '741f34ce-fb96-427d-8048-dac0c30395fc';

console.log('🔑 API Key:', apiKey.substring(0, 10) + '...');
console.log('🏢 Organization:', organization);
console.log('🎯 Model ID:', modelId);

// Test different endpoint patterns
const endpointVariations = [
  // Standard endpoints
  'https://api.mindee.net/v1/products/mindee/invoices/v4/predict',
  'https://api.mindee.com/v1/products/mindee/invoices/v4/predict',
  
  // Custom model endpoints
  `https://api.mindee.net/v1/products/${organization}/${modelId}/predict`,
  `https://api.mindee.com/v1/products/${organization}/${modelId}/predict`,
  
  // Alternative API versions
  'https://api.mindee.net/v1/products/mindee/financial_document/v1/predict',
  'https://api.mindee.net/v1/products/mindee/receipts/v5/predict',
  
  // EU specific (if exists)
  'https://eu.api.mindee.net/v1/products/mindee/invoices/v4/predict',
];

async function testEndpoint(endpoint, index) {
  console.log(`\n${index + 1}. 🌐 Testing: ${endpoint}`);
  
  try {
    const formData = new FormData();
    const emptyBlob = new Blob(['test'], { type: 'image/jpeg' });
    formData.append('document', emptyBlob, '/images/TestDocument.jpg');
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
      body: formData
    });
    
    console.log(`   📡 Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 400) {
      console.log('   ✅ SUCCESS! Auth working (400 = missing valid document)');
      return { success: true, endpoint, status: response.status };
    } else if (response.status === 401) {
      console.log('   ❌ Auth failed (401 = unauthorized)');
    } else if (response.status === 404) {
      console.log('   ❌ Endpoint not found (404)');
    } else {
      console.log(`   ℹ️ Unexpected status: ${response.status}`);
    }
    
    const responseText = await response.text();
    console.log(`   📄 Response: ${responseText.substring(0, 150)}...`);
    
    return { success: false, endpoint, status: response.status, response: responseText };
    
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
    return { success: false, endpoint, error: error.message };
  }
}

// Test account info endpoint
async function testAccountInfo() {
  console.log('\n🔍 Testing account info endpoint...');
  
  try {
    const response = await fetch('https://api.mindee.net/v1/account', {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Account Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 200) {
      const accountData = await response.json();
      console.log('✅ Account info retrieved:', JSON.stringify(accountData, null, 2));
      return accountData;
    } else {
      const errorText = await response.text();
      console.log('❌ Account error:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Account request failed:', error.message);
  }
  
  return null;
}

async function runAdvancedTests() {
  console.log('🚀 Starting advanced API tests...\n');
  
  // Test account info first
  const accountInfo = await testAccountInfo();
  
  // Test all endpoint variations
  const results = [];
  for (let i = 0; i < endpointVariations.length; i++) {
    const result = await testEndpoint(endpointVariations[i], i);
    results.push(result);
    
    // If we find a working endpoint, break
    if (result.success) {
      console.log(`\n🎉 FOUND WORKING ENDPOINT: ${result.endpoint}`);
      break;
    }
  }
  
  console.log('\n📊 SUMMARY:');
  console.log('===========');
  
  const workingEndpoints = results.filter(r => r.success);
  const failedEndpoints = results.filter(r => !r.success);
  
  console.log(`✅ Working endpoints: ${workingEndpoints.length}`);
  workingEndpoints.forEach(ep => console.log(`   - ${ep.endpoint}`));
  
  console.log(`❌ Failed endpoints: ${failedEndpoints.length}`);
  
  if (workingEndpoints.length === 0) {
    console.log('\n🚨 NO WORKING ENDPOINTS FOUND!');
    console.log('💡 Possible issues:');
    console.log('   1. API key is for a different region/environment');
    console.log('   2. Account needs activation or verification');
    console.log('   3. API key permissions are restricted');
    console.log('   4. Organization/account configuration issue');
    console.log('\n🔧 Recommended actions:');
    console.log('   1. Check Mindee dashboard for account status');
    console.log('   2. Verify API key permissions and scope');
    console.log('   3. Try creating a new API key');
    console.log('   4. Contact Mindee support if issue persists');
  }
  
  console.log('\n🏁 Advanced test completed!');
  return workingEndpoints;
}

runAdvancedTests();