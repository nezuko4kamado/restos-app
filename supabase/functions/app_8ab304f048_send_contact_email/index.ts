import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const RECIPIENT_EMAIL = "salvo89uk@gmail.com"; // Hidden in backend

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

Deno.serve(async (req) => {
  // Generate unique request ID for logging
  const requestId = crypto.randomUUID();
  console.log(`[${requestId}] 📧 Contact form request received`);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error(`[${requestId}] ❌ Invalid JSON body:`, e);
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { name, email, subject, message } = body;
    
    console.log(`[${requestId}] 📝 Form data:`, {
      name,
      email,
      subject,
      messageLength: message?.length
    });

    // Validate required fields
    if (!name || !email || !subject || !message) {
      console.error(`[${requestId}] ❌ Missing required fields`);
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error(`[${requestId}] ❌ Invalid email format`);
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get SMTP configuration from environment
    const SMTP_HOST = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const SMTP_USER = Deno.env.get('SMTP_USER');
    const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD');
    const SMTP_FROM = Deno.env.get('SMTP_FROM') || 'noreply@resto.app';

    if (!SMTP_USER || !SMTP_PASSWORD) {
      console.error(`[${requestId}] ❌ SMTP not configured`);
      return new Response(
        JSON.stringify({ 
          error: 'Email service not configured. Please contact administrator.' 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create SMTP client
    console.log(`[${requestId}] 🔧 Creating SMTP client...`);
    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASSWORD,
        },
      },
    });

    // Email content
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Nuovo Messaggio da RESTO Contact Form</h2>
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Da:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Oggetto:</strong> ${subject}</p>
        </div>
        <div style="background-color: #ffffff; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h3 style="color: #374151;">Messaggio:</h3>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
        <div style="margin-top: 20px; padding: 15px; background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            <strong>Nota:</strong> Rispondi direttamente a ${email} per contattare l'utente.
          </p>
        </div>
      </div>
    `;

    const emailText = `
Nuovo Messaggio da RESTO Contact Form

Da: ${name}
Email: ${email}
Oggetto: ${subject}

Messaggio:
${message}

---
Rispondi direttamente a ${email} per contattare l'utente.
    `;

    // Send email
    console.log(`[${requestId}] 📤 Sending email to ${RECIPIENT_EMAIL}...`);
    await client.send({
      from: SMTP_FROM,
      to: RECIPIENT_EMAIL,
      replyTo: email,
      subject: `[RESTO] ${subject}`,
      content: emailText,
      html: emailHtml,
    });

    await client.close();

    console.log(`[${requestId}] ✅ Email sent successfully`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Email sent successfully'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error(`[${requestId}] ❌ Error sending email:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to send email',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});