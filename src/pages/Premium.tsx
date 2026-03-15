export default function Premium() {
  return (
    <div dangerouslySetInnerHTML={{
      __html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RESTOS PRO – Unlock Everything</title>
  <style>
    body,html{margin:0;padding:0;height:100%;background:linear-gradient(135deg,#00d4aa,#007cff);color:white;font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center}
    .card{background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);border-radius:24px;padding:40px 30px;max-width:380px;width:90%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,0.2)}
    h1{font-size:2.8em;margin:0 0 10px;font-weight:800}
    .price{font-size:4em;margin:20px 0 10px;font-weight:900}
    .trial{font-size:1.3em;margin:15px 0}
    .features{line-height:2;font-size:1.2em;margin:30px 0}
    .btn{background:white;color:#007cff;font-size:1.4em;font-weight:bold;padding:18px 50px;border:none;border-radius:16px;margin:30px 0 20px;width:100%;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,0.3)}
    .small{font-size:0.95em;opacity:0.9}
  </style>
</head>
<body>
  <div class="card">
    <h1>Welcome to RESTOS</h1>
    <p style="font-size:1.3em;margin:15px 0">Unlock all features with RESTOS PRO</p>
    
    <div class="price">19.90 €<small style="font-size:0.5em">/month</small></div>
    <div class="trial">7 days free · Then 19.90 €/month</div>
    
    <div class="features">
      Unlimited invoices & products<br>
      Instant price increase alerts<br>
      One-click WhatsApp orders<br>
      Monthly PDF reports<br>
      Food cost calculator<br>
      Multi-location (up to 5 venues)<br>
      Priority WhatsApp support
    </div>
    
    <button class="btn" onclick="startGooglePurchase()">
      Start 7-day free trial
    </button>
    
    <div class="small">
      Cancel anytime in Google Play<br>
      Secure payment · No commitment
    </div>
  </div>

  <script>
    function startGooglePurchase() {
      if (window.Twinr && window.Twinr.purchase) {
        window.Twinr.purchase('premium_monthly');  // Product ID exact
      } else {
        alert('Loading… please wait 2 seconds and try again');
      }
    }
  </script>
</body>
</html>
      `
    }} />
  );
}