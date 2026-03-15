# 🚀 Guida Deploy Funzioni Supabase - Metodo Dashboard

## STEP 1: Accedi alla Dashboard

1. Vai su: https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw/functions
2. Accedi con il tuo account Supabase

---

## STEP 2: Deploy Funzione `create-checkout-session`

### 2.1 Crea la funzione
1. Clicca il pulsante **"Create function"** (in alto a destra)
2. Nome funzione: `create-checkout-session`
3. Clicca **"Create function"**

### 2.2 Copia il codice
Nell'editor che si apre, **cancella tutto** e incolla questo codice:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import Stripe from 'https://esm.sh/stripe@14.10.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Use the new Price ID for €9.90/month subscription
const PRICE_ID = 'price_1SU3sqERHOOWoH8ZDOGUWvV1';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user from auth header using anon key
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create client with anon key for auth validation
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error('User authentication error:', userError);
      throw new Error('Unauthorized - Invalid or expired token');
    }

    // Get user email
    const userEmail = user.email;

    // Create or retrieve Stripe customer
    let customerId: string;
    
    // Search for existing customer by email
    const existingCustomers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
      
      // Update metadata to include user_id
      await stripe.customers.update(customerId, {
        metadata: {
          user_id: user.id,
        },
      });
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          user_id: user.id,
        },
      });
      customerId = customer.id;
    }

    // Get the origin for redirect URLs
    const origin = req.headers.get('origin') || 'http://localhost:5173';

    // Create Stripe Checkout Session with the new Price ID
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}/?success=true`,
      cancel_url: `${origin}/?canceled=true`,
      metadata: {
        user_id: user.id,
      },
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          user_id: user.id,
        },
      },
    });

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
```

### 2.3 Deploy
1. Clicca **"Deploy function"** (in alto a destra)
2. Aspetta che compaia il messaggio di successo ✅

---

## STEP 3: Deploy Funzione `check-subscription-status`

### 3.1 Crea la funzione
1. Torna alla lista delle funzioni (clicca "Edge Functions" nel menu a sinistra)
2. Clicca di nuovo **"Create function"**
3. Nome funzione: `check-subscription-status`
4. Clicca **"Create function"**

### 3.2 Copia il codice
Nell'editor, **cancella tutto** e incolla questo codice:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search for customer by metadata (user_id)
    const customers = await stripe.customers.list({
      limit: 100,
      expand: ['data.subscriptions'],
    });

    // Find customer with matching user_id in metadata
    const customer = customers.data.find(
      (c) => c.metadata?.user_id === userId
    );

    if (!customer) {
      // No customer found, return trial status
      return new Response(
        JSON.stringify({
          isActive: false,
          status: 'trialing',
          currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionType: 'trial',
          daysRemaining: 7,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer's subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      // No subscription found, return trial status
      return new Response(
        JSON.stringify({
          isActive: false,
          status: 'trialing',
          currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          subscriptionType: 'trial',
          daysRemaining: 7,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subscription = subscriptions.data[0];
    const isActive = subscription.status === 'active' || subscription.status === 'trialing';
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const daysRemaining = Math.ceil(
      (subscription.current_period_end * 1000 - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return new Response(
      JSON.stringify({
        isActive,
        status: subscription.status,
        currentPeriodEnd,
        subscriptionType: subscription.status === 'active' ? 'paid' : 'trial',
        daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error checking subscription:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### 3.3 Deploy
1. Clicca **"Deploy function"** (in alto a destra)
2. Aspetta che compaia il messaggio di successo ✅

---

## STEP 4: Configura la Chiave Segreta Stripe

### 4.1 Vai alle impostazioni
1. Nel menu a sinistra, clicca su **"Project Settings"** (icona ingranaggio ⚙️)
2. Clicca su **"Edge Functions"**
3. Scorri fino alla sezione **"Secrets"**

### 4.2 Aggiungi il secret
1. Clicca **"Add new secret"**
2. Nome: `STRIPE_SECRET_KEY`
3. Valore: `YOUR_STRIPE_SECRET_KEY`
4. Clicca **"Save"**

---

## ✅ COMPLETATO!

Ora le tue funzioni sono online e pronte! 🎉

### Verifica che tutto funzioni:
1. Vai alla tua app: https://tuo-sito.com
2. Prova a fare login
3. Clicca su "Upgrade to Premium"
4. Dovresti essere reindirizzato a Stripe per il pagamento

### URL delle funzioni:
- `create-checkout-session`: https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/create-checkout-session
- `check-subscription-status`: https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/check-subscription-status

---

## 🆘 Problemi?

Se qualcosa non funziona:
1. Controlla i **logs** nella dashboard Supabase (sezione "Edge Functions" → clicca sulla funzione → tab "Logs")
2. Verifica che il secret `STRIPE_SECRET_KEY` sia stato salvato correttamente
3. Assicurati che il Price ID `price_1SU3sqERHOOWoH8ZDOGUWvV1` esista in Stripe

Buon lavoro! 🚀