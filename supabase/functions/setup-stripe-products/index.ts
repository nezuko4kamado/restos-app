import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const products = [
      {
        name: 'BASIC',
        price: 499, // €4.99 in cents
        description: '40 products, 20 invoices/month, 20 scans/month',
        features: ['40 Products', '20 Invoices per month', '20 Scans per month'],
      },
      {
        name: 'PRO',
        price: 999, // €9.99 in cents
        description: '100 products, 50 invoices/month, 50 scans/month',
        features: ['100 Products', '50 Invoices per month', '50 Scans per month'],
      },
      {
        name: 'PREMIUM',
        price: 1499, // €14.99 in cents
        description: 'Unlimited products, invoices and scans',
        features: ['Unlimited Products', 'Unlimited Invoices', 'Unlimited Scans', 'Priority Support'],
      },
    ];

    const createdProducts = [];

    for (const productData of products) {
      // Create product
      const product = await stripe.products.create({
        name: `${productData.name} Plan`,
        description: productData.description,
        metadata: {
          plan_type: productData.name,
          features: JSON.stringify(productData.features),
        },
      });

      // Create recurring price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: productData.price,
        currency: 'eur',
        recurring: {
          interval: 'month',
        },
        metadata: {
          plan_type: productData.name,
        },
      });

      createdProducts.push({
        plan: productData.name,
        productId: product.id,
        priceId: price.id,
        amount: productData.price / 100,
        currency: 'EUR',
      });

      console.log(`Created ${productData.name} plan - Price ID: ${price.id}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        products: createdProducts,
        message: 'Stripe products created successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error creating Stripe products:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});