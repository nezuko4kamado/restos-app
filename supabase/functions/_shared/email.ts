// Shared email utility for sending notifications via Resend
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const NOTIFICATION_EMAIL = 'info@amalfi-alzira.es';

interface EmailParams {
  subject: string;
  html: string;
}

export async function sendNotificationEmail({ subject, html }: EmailParams): Promise<void> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Restaurant App <notifications@resend.dev>',
        to: [NOTIFICATION_EMAIL],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to send email:', error);
    } else {
      console.log('Email sent successfully:', subject);
    }
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

export function formatUserRegistrationEmail(userEmail: string, userId: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🎉 Nuova Registrazione Utente</h2>
        </div>
        <div class="content">
          <p>Un nuovo utente si è registrato nell'applicazione:</p>
          <div class="info-row">
            <span class="label">Email:</span> ${userEmail}
          </div>
          <div class="info-row">
            <span class="label">User ID:</span> ${userId}
          </div>
          <div class="info-row">
            <span class="label">Data:</span> ${new Date().toLocaleString('it-IT')}
          </div>
        </div>
        <div class="footer">
          <p>Questa è una notifica automatica dal sistema Restaurant App</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function formatSubscriptionCreatedEmail(
  userEmail: string,
  subscriptionId: string,
  priceId: string,
  status: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; }
        .status { display: inline-block; padding: 5px 10px; border-radius: 5px; background-color: #10B981; color: white; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>✅ Nuovo Abbonamento Creato</h2>
        </div>
        <div class="content">
          <p>Un nuovo abbonamento è stato creato con successo:</p>
          <div class="info-row">
            <span class="label">Email Utente:</span> ${userEmail}
          </div>
          <div class="info-row">
            <span class="label">Subscription ID:</span> ${subscriptionId}
          </div>
          <div class="info-row">
            <span class="label">Piano:</span> ${priceId}
          </div>
          <div class="info-row">
            <span class="label">Stato:</span> <span class="status">${status}</span>
          </div>
          <div class="info-row">
            <span class="label">Data:</span> ${new Date().toLocaleString('it-IT')}
          </div>
        </div>
        <div class="footer">
          <p>Questa è una notifica automatica dal sistema Restaurant App</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function formatSubscriptionCanceledEmail(
  userEmail: string,
  subscriptionId: string,
  canceledAt: Date
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #EF4444; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; }
        .warning { color: #EF4444; font-weight: bold; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>❌ Abbonamento Cancellato</h2>
        </div>
        <div class="content">
          <p class="warning">Un abbonamento è stato cancellato:</p>
          <div class="info-row">
            <span class="label">Email Utente:</span> ${userEmail}
          </div>
          <div class="info-row">
            <span class="label">Subscription ID:</span> ${subscriptionId}
          </div>
          <div class="info-row">
            <span class="label">Data Cancellazione:</span> ${canceledAt.toLocaleString('it-IT')}
          </div>
          <div class="info-row">
            <span class="label">Notifica Ricevuta:</span> ${new Date().toLocaleString('it-IT')}
          </div>
        </div>
        <div class="footer">
          <p>Questa è una notifica automatica dal sistema Restaurant App</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function formatPaymentFailedEmail(
  userEmail: string,
  subscriptionId: string,
  amount: number,
  currency: string,
  errorMessage?: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; }
        .info-row { margin: 10px 0; }
        .label { font-weight: bold; }
        .alert { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 10px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>⚠️ Pagamento Fallito</h2>
        </div>
        <div class="content">
          <div class="alert">
            <strong>Attenzione:</strong> Un pagamento non è andato a buon fine
          </div>
          <div class="info-row">
            <span class="label">Email Utente:</span> ${userEmail}
          </div>
          <div class="info-row">
            <span class="label">Subscription ID:</span> ${subscriptionId}
          </div>
          <div class="info-row">
            <span class="label">Importo:</span> ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
          </div>
          ${errorMessage ? `
          <div class="info-row">
            <span class="label">Errore:</span> ${errorMessage}
          </div>
          ` : ''}
          <div class="info-row">
            <span class="label">Data:</span> ${new Date().toLocaleString('it-IT')}
          </div>
        </div>
        <div class="footer">
          <p>Questa è una notifica automatica dal sistema Restaurant App</p>
        </div>
      </div>
    </body>
    </html>
  `;
}