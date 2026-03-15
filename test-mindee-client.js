// Test script per verificare l'integrazione della libreria ufficiale Mindee
console.log('🔍 MINDEE OFFICIAL CLIENT LIBRARY TEST');
console.log('=====================================');

// Test con URL Supabase deployato
async function testDeployedFunction() {
  console.log('🌐 Testing deployed Supabase Edge Function...');
  
  const testImageBase64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A8A';
  
  const testPayload = {
    image: testImageBase64,
    filename: '/images/photo1765795890.jpg',
    mode: 'products'
  };
  
  try {
    const response = await fetch('https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/mindee_ocr_processor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteG1rdmluc3Z1emJ6cmpydWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mzc4ODIsImV4cCI6MjA3ODUxMzg4Mn0.bz5siYBfM4UVV6cerbHPzmII7DnDLP3ynH2OV2Ts3So'
      },
      body: JSON.stringify(testPayload)
    });
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Edge Function response:');
      console.log('📊 Result summary:', {
        supplier: result.supplier?.name || 'N/A',
        invoiceNumber: result.invoice_number || 'N/A',
        total: result.total || 0,
        productsCount: result.products?.length || 0,
        source: result.source || 'unknown',
        confidence: result.confidence || 'N/A',
        requestId: result.requestId || 'N/A'
      });
      
      if (result.source === 'mindee_official_client') {
        console.log('🎉 SUCCESS! Mindee official client working!');
      } else if (result.source === 'intelligent_demo_fallback') {
        console.log('⚠️ Using fallback data - Mindee API issue detected');
        console.log('🔍 Error details:', result.error || result.note || 'No specific error');
      }
      
      // Show sample products
      if (result.products && result.products.length > 0) {
        console.log('\n📦 Sample products extracted:');
        result.products.slice(0, 3).forEach((product, index) => {
          console.log(`   ${index + 1}. ${product.name} - €${product.price} x ${product.quantity}${product.unit} = €${product.total}`);
        });
        if (result.products.length > 3) {
          console.log(`   ... and ${result.products.length - 3} more products`);
        }
      }
      
      return result;
    } else {
      const errorText = await response.text();
      console.log('❌ Edge Function error:', errorText);
    }
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

async function runTest() {
  console.log('🚀 Testing Mindee integration with official client library...\n');
  
  const result = await testDeployedFunction();
  
  console.log('\n📊 INTEGRATION STATUS:');
  console.log('======================');
  
  if (result) {
    console.log('✅ Edge Function: Working');
    console.log('✅ API Response: Valid JSON');
    console.log('✅ Data Extraction: Functional');
    console.log(`📍 Source: ${result.source}`);
    
    if (result.source === 'mindee_official_client') {
      console.log('🎉 MINDEE OFFICIAL CLIENT: WORKING PERFECTLY!');
      console.log('✅ Authentication: Success');
      console.log('✅ Custom Model: Accessible');
      console.log('✅ Data Processing: Complete');
    } else {
      console.log('⚠️ MINDEE CLIENT: Using fallback mode');
      console.log('🔧 Action needed: Check Mindee account configuration');
    }
  } else {
    console.log('❌ Edge Function: Failed');
    console.log('🔧 Action needed: Check Edge Function deployment');
  }
  
  console.log('\n💡 NEXT STEPS:');
  console.log('1. Test from RESTOS frontend with real invoice upload');
  console.log('2. Monitor Supabase Edge Function logs for detailed debugging');
  console.log('3. Verify Mindee account status if using fallback');
  
  console.log('\n🏁 Test completed!');
}

runTest();