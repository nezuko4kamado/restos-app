const Stripe = require('stripe');

// You need to replace this with your actual Stripe Secret Key
const STRIPE_SECRET_KEY = 'sk_test_YOUR_KEY_HERE'; // Replace with actual key from Supabase secrets

const stripe = new Stripe(STRIPE_SECRET_KEY, {
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

async function createStripeProducts() {
  console.log('Creating Stripe products...\n');
  
  const createdProducts = [];

  for (const productData of products) {
    try {
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

      console.log(`✅ Created ${productData.name} Plan`);
      console.log(`   Product ID: ${product.id}`);
      console.log(`   Price ID: ${price.id}`);
      console.log(`   Amount: €${productData.price / 100}/month\n`);
    } catch (error) {
      console.error(`❌ Error creating ${productData.name} plan:`, error.message);
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Copy these Price IDs to update SubscriptionManager.tsx:\n');
  
  createdProducts.forEach(p => {
    console.log(`${p.plan}: ${p.priceId}`);
  });

  console.log('\n=== WEBHOOK URL ===');
  console.log('Configure this webhook URL in your Stripe Dashboard:');
  console.log('https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook');
  console.log('\nWebhook events to listen for:');
  console.log('- customer.subscription.created');
  console.log('- customer.subscription.updated');
  console.log('- customer.subscription.deleted');
  console.log('- invoice.payment_succeeded');
  console.log('- invoice.payment_failed');

  return createdProducts;
}

createStripeProducts()
  .then(() => {
    console.log('\n✅ All products created successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });