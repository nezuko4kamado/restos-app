import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 🚀 MINDEE OCR Request`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // Parse body JSON
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[${requestId}] ❌ Invalid JSON body`, e);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON body",
          requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { imageBase64, image, filename, mode } = body;
    const base64Image = imageBase64 || image;

    if (!base64Image) {
      console.error(`[${requestId}] ❌ Missing imageBase64/image`);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing imageBase64 parameter",
          requestId,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(`[${requestId}] 📄 Image received`, {
      filename: filename || "unknown",
      length: base64Image.length,
      mode: mode || "products",
    });

    // Prende la API key da Supabase secrets
    const mindeeApiKey = Deno.env.get("MINDEE_V2_API_KEY");
    if (!mindeeApiKey || !mindeeApiKey.startsWith("md_")) {
      console.error(
        `[${requestId}] ❌ Missing or invalid MINDEE_V2_API_KEY env var`,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing MINDEE_V2_API_KEY environment variable",
          requestId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      `[${requestId}] 🔑 Using Mindee API key: ${mindeeApiKey.substring(0, 8)}...`,
    );

    // Base64 → binary
    const cleanedBase64 = base64Image.replace(
      /^data:image\/[a-zA-Z0-9+.+-]+;base64,/,
      "",
    );
    const bin = atob(cleanedBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }

    console.log(
      `[${requestId}] 🔄 Converted to binary: ${bytes.length} bytes`,
    );

    const formData = new FormData();
    formData.append(
      "document",
      new Blob([bytes], { type: "image/jpeg" }),
      filename || "invoice.jpg",
    );

    // Endpoint sincrono Invoice v4 (predefinito)
    const endpoint =
      "https://api.mindee.net/v1/products/mindee/invoice_v4/1.7/predict";
    console.log(`[${requestId}] 🌐 Calling Mindee: ${endpoint}`);

    const mindeeResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Token ${mindeeApiKey}`,
      },
      body: formData,
    });

    console.log(
      `[${requestId}] 📡 Mindee status: ${mindeeResponse.status} ${mindeeResponse.statusText}`,
    );

    if (!mindeeResponse.ok) {
      const errorText = await mindeeResponse.text();
      console.error(
        `[${requestId}] ❌ Mindee error body: ${errorText.slice(0, 500)}`,
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: `Mindee error ${mindeeResponse.status}`,
          details: errorText,
          requestId,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const mindeeData = await mindeeResponse.json();
    console.log(
      `[${requestId}] ✅ Mindee response parsed, keys:`,
      Object.keys(mindeeData),
    );

    // Oggetto prediction standard Invoice v4
    const prediction =
      mindeeData?.prediction?.document?.inference?.prediction ??
      mindeeData?.document?.inference?.prediction ??
      {};

    const supplier = {
      name: prediction.supplier_name?.value ?? "Unknown Supplier",
      email: prediction.supplier_email?.value ?? "",
      phone: prediction.supplier_phone?.value ?? "",
      address: prediction.supplier_address?.value ?? "",
    };

    const invoice_number =
      prediction.invoice_number?.value ??
      prediction.reference?.value ??
      `INV-${Date.now()}`;

    const invoice_date =
      prediction.invoice_date?.value ??
      prediction.date?.value ??
      new Date().toISOString().split("T")[0];

    const total =
      prediction.total_incl?.value ??
      prediction.total_amount?.value ??
      prediction.total_net?.value ??
      0;

    const currency = prediction.currency?.value ?? "EUR";

    let products: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
      unit: string;
      total: number;
      category?: string;
    }> = [];

    const lineItems = prediction.line_items?.array;
    if (Array.isArray(lineItems)) {
      products = lineItems.map((item: any, index: number) => {
        const name =
          item.description?.value ??
          item.product_name?.value ??
          `Prodotto ${index + 1}`;
        const quantity = Number(item.quantity?.value ?? 1);
        const price = Number(item.unit_price?.value ?? 0);
        const totalAmount =
          Number(item.total_amount?.value ?? price * quantity);

        return {
          id: `prod_${index + 1}`,
          name,
          price,
          quantity,
          unit: item.unit?.value ?? "pz",
          total: totalAmount,
          category: "Estratto",
        };
      });
    }

    console.log(
      `[${requestId}] 📊 Extracted products: ${products.length}, total: ${total}`,
    );

    const responsePayload = {
      success: true,
      products,
      supplier,
      total,
      invoice_number,
      invoice_date,
      currency,
      requestId,
      source: "mindee_invoice_v4",
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(
      `[${requestId}] ❌ Unexpected error in edge function`,
      err,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error:
          err instanceof Error ? err.message : "Internal server error in OCR",
        requestId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
