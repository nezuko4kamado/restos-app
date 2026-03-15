#!/bin/bash

# Leggi la Stripe Secret Key dalle variabili d'ambiente di Supabase
# Oppure inseriscila manualmente qui sotto sostituendo YOUR_STRIPE_SECRET_KEY
STRIPE_KEY="${STRIPE_SECRET_KEY:-YOUR_STRIPE_SECRET_KEY}"

if [ "$STRIPE_KEY" = "YOUR_STRIPE_SECRET_KEY" ]; then
    echo "❌ Errore: Devi configurare la STRIPE_SECRET_KEY"
    echo ""
    echo "Opzione 1: Esporta la variabile d'ambiente:"
    echo "  export STRIPE_SECRET_KEY='sk_test_...' && bash create_stripe_products.sh"
    echo ""
    echo "Opzione 2: Modifica questo script e sostituisci YOUR_STRIPE_SECRET_KEY con la tua chiave"
    exit 1
fi

echo "=== Creazione Prodotti Stripe ==="
echo ""

# Crea BASIC Plan
echo "📦 Creazione BASIC Plan (€9.99/mese)..."
BASIC_PRODUCT=$(curl -s -X POST https://api.stripe.com/v1/products \
  -u "$STRIPE_KEY:" \
  -d "name=BASIC Plan" \
  -d "description=50 prodotti, 100 fatture/mese")

BASIC_PRODUCT_ID=$(echo $BASIC_PRODUCT | grep -o '"id":"prod_[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$BASIC_PRODUCT_ID" ]; then
    echo "❌ Errore nella creazione del prodotto BASIC"
    exit 1
fi

BASIC_PRICE=$(curl -s -X POST https://api.stripe.com/v1/prices \
  -u "$STRIPE_KEY:" \
  -d "product=$BASIC_PRODUCT_ID" \
  -d "unit_amount=999" \
  -d "currency=eur" \
  -d "recurring[interval]=month")

BASIC_PRICE_ID=$(echo $BASIC_PRICE | grep -o '"id":"price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ BASIC Plan creato - Price ID: $BASIC_PRICE_ID"
echo ""

# Crea PRO Plan
echo "📦 Creazione PRO Plan (€19.99/mese)..."
PRO_PRODUCT=$(curl -s -X POST https://api.stripe.com/v1/products \
  -u "$STRIPE_KEY:" \
  -d "name=PRO Plan" \
  -d "description=200 prodotti, 500 fatture/mese")

PRO_PRODUCT_ID=$(echo $PRO_PRODUCT | grep -o '"id":"prod_[^"]*"' | head -1 | cut -d'"' -f4)

PRO_PRICE=$(curl -s -X POST https://api.stripe.com/v1/prices \
  -u "$STRIPE_KEY:" \
  -d "product=$PRO_PRODUCT_ID" \
  -d "unit_amount=1999" \
  -d "currency=eur" \
  -d "recurring[interval]=month")

PRO_PRICE_ID=$(echo $PRO_PRICE | grep -o '"id":"price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ PRO Plan creato - Price ID: $PRO_PRICE_ID"
echo ""

# Crea PREMIUM Plan
echo "📦 Creazione PREMIUM Plan (€99.99/mese)..."
PREMIUM_PRODUCT=$(curl -s -X POST https://api.stripe.com/v1/products \
  -u "$STRIPE_KEY:" \
  -d "name=PREMIUM Plan" \
  -d "description=Prodotti e fatture illimitati")

PREMIUM_PRODUCT_ID=$(echo $PREMIUM_PRODUCT | grep -o '"id":"prod_[^"]*"' | head -1 | cut -d'"' -f4)

PREMIUM_PRICE=$(curl -s -X POST https://api.stripe.com/v1/prices \
  -u "$STRIPE_KEY:" \
  -d "product=$PREMIUM_PRODUCT_ID" \
  -d "unit_amount=9999" \
  -d "currency=eur" \
  -d "recurring[interval]=month")

PREMIUM_PRICE_ID=$(echo $PREMIUM_PRICE | grep -o '"id":"price_[^"]*"' | head -1 | cut -d'"' -f4)
echo "✅ PREMIUM Plan creato - Price ID: $PREMIUM_PRICE_ID"
echo ""

echo "=== ✅ COMPLETATO ==="
echo ""
echo "📋 PRICE IDs GENERATI:"
echo "BASIC_PRICE_ID=$BASIC_PRICE_ID"
echo "PRO_PRICE_ID=$PRO_PRICE_ID"
echo "PREMIUM_PRICE_ID=$PREMIUM_PRICE_ID"
echo ""
echo "💾 Salva questi Price ID - ti serviranno per aggiornare l'applicazione!"
echo ""
echo "📝 PROSSIMI PASSI:"
echo "1. Copia i Price ID qui sopra"
echo "2. Condividili con me così posso aggiornare il codice"
echo "3. Configura il webhook in Stripe Dashboard"
