// Customizable message templates for orders
// Supports placeholders and multi-language defaults

export interface MessageTemplates {
  whatsapp: string;
  email: string;
}

export const DEFAULT_TEMPLATES: Record<string, MessageTemplates> = {
  it: {
    whatsapp: `Buongiorno {supplier_name},

Questo è l'ordine da {store_name}:

{products}

Cordiali saluti,
{store_name}`,
    email: `Buongiorno {supplier_name},

Questo è l'ordine da {store_name} del {order_date}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Articoli ordinati:

{products}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Totale: {total}

Vi preghiamo di confermare la disponibilità e i tempi di consegna.

Cordiali saluti,
{store_name}`
  },
  en: {
    whatsapp: `Good morning {supplier_name},

This is the order from {store_name}:

{products}

Best regards,
{store_name}`,
    email: `Good morning {supplier_name},

This is the order from {store_name} on {order_date}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ordered items:

{products}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: {total}

Please confirm availability and delivery times.

Best regards,
{store_name}`
  },
  es: {
    whatsapp: `Buenos días {supplier_name},

Este es el pedido de {store_name}:

{products}

Saludos cordiales,
{store_name}`,
    email: `Buenos días {supplier_name},

Este es el pedido de {store_name} del {order_date}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Artículos pedidos:

{products}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: {total}

Por favor, confirme la disponibilidad y los plazos de entrega.

Saludos cordiales,
{store_name}`
  },
  fr: {
    whatsapp: `Bonjour {supplier_name},

Voici la commande de {store_name}:

{products}

Cordialement,
{store_name}`,
    email: `Bonjour {supplier_name},

Voici la commande de {store_name} du {order_date}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Articles commandés:

{products}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total: {total}

Veuillez confirmer la disponibilité et les délais de livraison.

Cordialement,
{store_name}`
  },
  de: {
    whatsapp: `Guten Morgen {supplier_name},

Dies ist die Bestellung von {store_name}:

{products}

Mit freundlichen Grüßen,
{store_name}`,
    email: `Guten Morgen {supplier_name},

Dies ist die Bestellung von {store_name} vom {order_date}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bestellte Artikel:

{products}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Gesamt: {total}

Bitte bestätigen Sie die Verfügbarkeit und Lieferzeiten.

Mit freundlichen Grüßen,
{store_name}`
  }
};

export function getDefaultTemplates(language: string): MessageTemplates {
  return DEFAULT_TEMPLATES[language] || DEFAULT_TEMPLATES.it;
}

export function replacePlaceholders(
  template: string,
  data: {
    supplier_name?: string;
    store_name?: string;
    order_date?: string;
    products?: string;
    total?: string;
  }
): string {
  let result = template;
  
  Object.entries(data).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    result = result.replace(new RegExp(placeholder, 'g'), value || '');
  });
  
  return result;
}
// Add Lithuanian templates
DEFAULT_TEMPLATES.lt = {
  whatsapp: `Labas {supplier_name},

Tai užsakymas iš {store_name}:

{products}

Pagarbiai,
{store_name}`,
  email: `Labas {supplier_name},

Tai užsakymas iš {store_name} {order_date}:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Užsakytos prekės:

{products}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Viso: {total}

Prašome patvirtinti prieinamumą ir pristatymo terminus.

Pagarbiai,
{store_name}`
};
