#!/bin/bash

echo "=== Stripe Product Setup Script ==="
echo ""
echo "Please enter your Stripe Secret Key (starts with sk_test_ or sk_live_):"
read -s STRIPE_KEY
echo ""

if [ -z "$STRIPE_KEY" ]; then
    echo "❌ Error: Stripe Secret Key is required"
    exit 1
fi

echo "Creating BASIC Plan (€9.99/month)..."
BASIC_PRODUCT=$(curl -s -X POST https://api.stripe.com/v1/products \
  -u "$STRIPE_KEY:" \
  -d "name=BASIC Plan" \
  -d "description=50 products, 100 invoices/month")

BASIC_PRODUCT_ID=$(echo $BASIC_PRODUCT | grep -o '"id":"prod_[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BASIC_PRODUCT_ID" ]; then
    echo "❌ Error creating BASIC product"
    echo "$BASIC_PRODUCT"
    exit 1
fi

BASIC_PRICE=$(curl -s -X POST https://api.stripe.com/v1/prices \
  -u "$STRIPE_KEY:" \
  -d "product=$BASIC_PRODUCT_ID" \
  -d "unit_amount=999" \
  -d "currency=eur" \
  -d "recurring[interval]=month")

BASIC_PRICE_ID=$(echo $BASIC_PRICE | grep -o '"id":"price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ BASIC Plan created - Price ID: $BASIC_PRICE_ID"
echo ""

echo "Creating PRO Plan (€19.99/month)..."
PRO_PRODUCT=$(curl -s -X POST https://api.stripe.com/v1/products \
  -u "$STRIPE_KEY:" \
  -d "name=PRO Plan" \
  -d "description=200 products, 500 invoices/month")

PRO_PRODUCT_ID=$(echo $PRO_PRODUCT | grep -o '"id":"prod_[^"]*"' | head -1 | cut -d'"' -f4)

PRO_PRICE=$(curl -s -X POST https://api.stripe.com/v1/prices \
  -u "$STRIPE_KEY:" \
  -d "product=$PRO_PRODUCT_ID" \
  -d "unit_amount=1999" \
  -d "currency=eur" \
  -d "recurring[interval]=month")

PRO_PRICE_ID=$(echo $PRO_PRICE | grep -o '"id":"price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ PRO Plan created - Price ID: $PRO_PRICE_ID"
echo ""

echo "Creating PREMIUM Plan (€99.99/month)..."
PREMIUM_PRODUCT=$(curl -s -X POST https://api.stripe.com/v1/products \
  -u "$STRIPE_KEY:" \
  -d "name=PREMIUM Plan" \
  -d "description=Unlimited products and invoices")

PREMIUM_PRODUCT_ID=$(echo $PREMIUM_PRODUCT | grep -o '"id":"prod_[^"]*"' | head -1 | cut -d'"' -f4)

PREMIUM_PRICE=$(curl -s -X POST https://api.stripe.com/v1/prices \
  -u "$STRIPE_KEY:" \
  -d "product=$PREMIUM_PRODUCT_ID" \
  -d "unit_amount=9999" \
  -d "currency=eur" \
  -d "recurring[interval]=month")

PREMIUM_PRICE_ID=$(echo $PREMIUM_PRICE | grep -o '"id":"price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ PREMIUM Plan created - Price ID: $PREMIUM_PRICE_ID"
echo ""

echo "=== SUMMARY ==="
echo "BASIC_PRICE_ID=$BASIC_PRICE_ID"
echo "PRO_PRICE_ID=$PRO_PRICE_ID"
echo "PREMIUM_PRICE_ID=$PREMIUM_PRICE_ID"
echo ""
echo "Save these Price IDs - you'll need them to update the application!"
echo ""
echo "=== WEBHOOK CONFIGURATION ==="
echo "Add this webhook URL in Stripe Dashboard:"
echo "https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook"
