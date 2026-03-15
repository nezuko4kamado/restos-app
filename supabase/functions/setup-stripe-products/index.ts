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
        price: 999, // €9.99 in cents
        description: '50 products, 100 invoices/month',
        features: ['50 Products', '100 Invoices per month', 'Email Support'],
      },
      {
        name: 'PRO',
        price: 1999, // €19.99 in cents
        description: '200 products, 500 invoices/month',
        features: ['200 Products', '500 Invoices per month', 'Priority Support', 'Advanced Analytics'],
      },
      {
        name: 'PREMIUM',
        price: 9999, // €99.99 in cents
        description: 'Unlimited products and invoices',
        features: ['Unlimited Products', 'Unlimited Invoices', '24/7 Premium Support', 'Custom Integrations', 'Dedicated Account Manager'],
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