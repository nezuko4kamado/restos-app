import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`🚀 [${requestId}] MINDEE OCR Request received: ${req.method} ${req.url}`);

  // Handle CORS preflight requests - MUST return status 200
  if (req.method === 'OPTIONS') {
    console.log(`✅ [${requestId}] Handling CORS preflight request`);
    return new Response('ok', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  // Only allow POST requests for actual processing
  if (req.method !== 'POST') {
    console.log(`❌ [${requestId}] Method not allowed: ${req.method}`);
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }), 
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    console.log(`📋 [${requestId}] Processing Mindee OCR request`);

    // Parse request body
    let body;
    try {
      body = await req.json();
      console.log(`📦 [${requestId}] Request body parsed successfully`);
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to parse request body:`, error);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { imageBase64, country = 'ES', language = 'es' } = body;

    if (!imageBase64) {
      console.error(`❌ [${requestId}] Missing imageBase64 in request`);
      return new Response(
        JSON.stringify({ error: 'Missing imageBase64 parameter' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🖼️ [${requestId}] Image base64 length: ${imageBase64.length} characters`);
    console.log(`🌍 [${requestId}] Country: ${country}, Language: ${language}`);

    // Get Mindee API key from environment
    const mindeeApiKey = Deno.env.get('MINDEE_API_KEY');
    if (!mindeeApiKey) {
      console.error(`❌ [${requestId}] MINDEE_API_KEY not found in environment`);
      return new Response(
        JSON.stringify({ error: 'Mindee API key not configured' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔑 [${requestId}] Mindee API key found`);

    // Convert base64 to binary
    let imageBuffer;
    try {
      // Remove data URL prefix if present
      const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      console.log(`🔄 [${requestId}] Image converted to buffer, size: ${imageBuffer.length} bytes`);
    } catch (error) {
      console.error(`❌ [${requestId}] Failed to convert base64 to buffer:`, error);
      return new Response(
        JSON.stringify({ error: 'Invalid base64 image data' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Prepare FormData for Mindee API
    const formData = new FormData();
    formData.append('document', new Blob([imageBuffer], { type: 'image/jpeg' }), '/images/photo1765760534.jpg');

    console.log(`📡 [${requestId}] Calling Mindee Invoice API v4...`);

    // Call Mindee Invoice API v4
    const mindeeResponse = await fetch('https://api.mindee.net/v1/products/mindee/invoices/v4/predict', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${mindeeApiKey}`,
      },
      body: formData,
    });

    console.log(`📨 [${requestId}] Mindee API response status: ${mindeeResponse.status}`);

    if (!mindeeResponse.ok) {
      const errorText = await mindeeResponse.text();
      console.error(`❌ [${requestId}] Mindee API error: ${mindeeResponse.status} - ${errorText}`);
      return new Response(
        JSON.stringify({ error: `Mindee API error: ${mindeeResponse.status}` }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const mindeeData = await mindeeResponse.json();
    console.log(`✅ [${requestId}] Mindee API response received successfully`);

    // Extract relevant data from Mindee response
    const document = mindeeData.document;
    const inference = document?.inference;
    const prediction = inference?.prediction;

    if (!prediction) {
      console.error(`❌ [${requestId}] No prediction data in Mindee response`);
      return new Response(
        JSON.stringify({ error: 'No prediction data received from Mindee' }), 
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`🔍 [${requestId}] Processing Mindee prediction data...`);

    // Convert Mindee format to expected format
    const responseData = {
      components: {
        amount_details: {
          amount_total: { 
            value: prediction.total_amount?.value || 0, 
            confidence: prediction.total_amount?.confidence || 0 
          },
          amount_subtotal: { 
            value: prediction.total_net?.value || 0, 
            confidence: prediction.total_net?.confidence || 0 
          },
          amount_tax: { 
            value: prediction.total_tax?.value || 0, 
            confidence: prediction.total_tax?.confidence || 0 
          },
          currency: { 
            value: prediction.locale?.currency || 'EUR', 
            confidence: prediction.locale?.confidence || 0 
          }
        },
        vendor_details: {
          vendor_name: { 
            value: prediction.supplier_name?.value || 'Unknown Supplier', 
            confidence: prediction.supplier_name?.confidence || 0 
          },
          vendor_address: { 
            value: prediction.supplier_address?.value || '', 
            confidence: prediction.supplier_address?.confidence || 0 
          },
          vendor_vat_number: { 
            value: prediction.supplier_company_registrations?.[0]?.value || '', 
            confidence: prediction.supplier_company_registrations?.[0]?.confidence || 0 
          },
          vendor_phone: { 
            value: '', 
            confidence: 0 
          }
        },
        document_details: {
          document_type: { 
            value: 'invoice', 
            confidence: 0.99 
          },
          document_number: { 
            value: prediction.invoice_number?.value || '', 
            confidence: prediction.invoice_number?.confidence || 0 
          },
          document_date: { 
            value: prediction.date?.value || '', 
            confidence: prediction.date?.confidence || 0 
          }
        },
        line_items: (prediction.line_items || []).map((item: any) => ({
          description: { 
            value: item.description || 'Unknown Item', 
            confidence: 0.9 
          },
          quantity: { 
            value: item.quantity || 1, 
            confidence: 0.9 
          },
          unit_price: { 
            value: item.unit_price || 0, 
            confidence: 0.9 
          },
          total_price: { 
            value: item.total_amount || 0, 
            confidence: 0.9 
          }
        }))
      },
      processing_info: {
        api_used: 'mindee_invoice_v4',
        timestamp: new Date().toISOString(),
        note: 'Processed with Mindee Invoice API v4'
      }
    };

    console.log(`📊 [${requestId}] Extracted ${responseData.components.line_items.length} line items`);
    console.log(`💰 [${requestId}] Total amount: ${responseData.components.amount_details.amount_total.value}`);
    console.log(`🏢 [${requestId}] Supplier: ${responseData.components.vendor_details.vendor_name.value}`);

    const response = {
      result: 'success',
      data: responseData
    };

    console.log(`✅ [${requestId}] Mindee OCR processing completed successfully`);

    return new Response(
      JSON.stringify(response), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error(`❌ [${requestId}] Unexpected error:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})