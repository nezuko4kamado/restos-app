// Multi-language email templates for order management
// Supports custom templates from settings with placeholder replacement

import { replacePlaceholders } from './messageTemplates';
import { formatPrice } from './currency';

export interface EmailTemplate {
  subject: string;
  greeting: string;
  intro: string;
  itemHeader: string;
  footer: string;
  closing: string;
}

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  it: {
    subject: 'Nuovo Ordine',
    greeting: 'Buongiorno',
    intro: 'Questo è l\'ordine:',
    itemHeader: 'Articoli ordinati:',
    footer: 'Vi preghiamo di confermare la disponibilità e i tempi di consegna.',
    closing: 'Cordiali saluti'
  },
  en: {
    subject: 'New Order',
    greeting: 'Good morning',
    intro: 'This is the order:',
    itemHeader: 'Ordered items:',
    footer: 'Please confirm availability and delivery times.',
    closing: 'Best regards'
  },
  es: {
    subject: 'Nuevo Pedido',
    greeting: 'Buenos días',
    intro: 'Este es el pedido:',
    itemHeader: 'Artículos pedidos:',
    footer: 'Por favor, confirme la disponibilidad y los plazos de entrega.',
    closing: 'Saludos cordiales'
  },
  fr: {
    subject: 'Nouvelle Commande',
    greeting: 'Bonjour',
    intro: 'Voici la commande:',
    itemHeader: 'Articles commandés:',
    footer: 'Veuillez confirmer la disponibilité et les délais de livraison.',
    closing: 'Cordialement'
  },
  de: {
    subject: 'Neue Bestellung',
    greeting: 'Guten Morgen',
    intro: 'Dies ist die Bestellung:',
    itemHeader: 'Bestellte Artikel:',
    footer: 'Bitte bestätigen Sie die Verfügbarkeit und Lieferzeiten.',
    closing: 'Mit freundlichen Grüßen'
  }
};

// Detect language from current app language setting
export function detectLanguageFromSettings(appLanguage?: string): string {
  if (!appLanguage) return 'it';
  
  // Map app language to template language
  const langMap: Record<string, string> = {
    'it': 'it',
    'en': 'en',
    'es': 'es',
    'fr': 'fr',
    'de': 'de',
    'lt': 'en' // Lithuanian uses English templates
  };
  
  return langMap[appLanguage] || 'it';
}

// Generate email message with custom template or fallback to default
export function generateEmailMessage(
  supplierName: string,
  items: Array<{ name: string; quantity: number; unit?: string; price?: number }>,
  phone?: string,
  storeName?: string,
  language?: string,
  customTemplate?: string,
  countryCode?: string
): { subject: string; body: string } {
  const lang = detectLanguageFromSettings(language);
  const template = EMAIL_TEMPLATES[lang] || EMAIL_TEMPLATES.it;
  const businessName = storeName || 'Il Nostro Negozio';
  
  // If custom template exists, use it
  if (customTemplate && customTemplate.trim()) {
    // Format products list
    let productsText = '';
    let total = 0;
    
    items.forEach((item, index) => {
      const unitDisplay = item.unit && item.unit.toLowerCase() !== 'pz' ? ` ${item.unit}` : '';
      productsText += `${index + 1}. ${item.name}\n`;
      productsText += `   Quantità: ${item.quantity}${unitDisplay}\n`;
      if (item.price) {
        const priceFormatted = countryCode ? formatPrice(item.price, countryCode) : `€${(Number(item.price) || 0).toFixed(2)}`;
        productsText += `   Prezzo: ${priceFormatted}\n`;
        total += item.price * item.quantity;
      }
      productsText += `\n`;
    });
    
    const totalFormatted = countryCode ? formatPrice(total, countryCode) : `€${(Number(total) || 0).toFixed(2)}`;
    
    const body = replacePlaceholders(customTemplate, {
      supplier_name: supplierName,
      store_name: businessName,
      order_date: new Date().toLocaleDateString(),
      products: productsText,
      total: totalFormatted
    });
    
    const subject = `${template.subject} - ${new Date().toLocaleDateString()}`;
    return { subject, body };
  }
  
  // Fallback to default template
  const subject = `${template.subject} - ${new Date().toLocaleDateString()}`;
  
  let body = `${template.greeting} ${supplierName},\n\n`;
  body += `${template.intro}\n\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  body += `${template.itemHeader}\n\n`;
  
  items.forEach((item, index) => {
    const unitDisplay = item.unit && item.unit.toLowerCase() !== 'pz' ? ` ${item.unit}` : '';
    body += `${index + 1}. ${item.name}\n`;
    body += `   Quantità: ${item.quantity}${unitDisplay}\n`;
    if (item.price) {
      const priceFormatted = countryCode ? formatPrice(item.price, countryCode) : `€${(Number(item.price) || 0).toFixed(2)}`;
      body += `   Prezzo: ${priceFormatted}\n`;
    }
    body += `\n`;
  });
  
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  body += `${template.footer}\n\n`;
  body += `${template.closing},\n`;
  body += `${businessName}`;
  
  return { subject, body };
}

// Generate WhatsApp message with custom template or fallback to default
export function generateWhatsAppMessage(
  supplierName: string,
  items: Array<{ name: string; quantity: number; unit?: string }>,
  phone?: string,
  storeName?: string,
  language?: string,
  customTemplate?: string
): string {
  const lang = detectLanguageFromSettings(language);
  const template = EMAIL_TEMPLATES[lang] || EMAIL_TEMPLATES.it;
  const businessName = storeName || 'Il Nostro Negozio';
  
  // If custom template exists, use it
  if (customTemplate && customTemplate.trim()) {
    // Format products list
    let productsText = '';
    items.forEach((item, index) => {
      const unitDisplay = item.unit && item.unit.toLowerCase() !== 'pz' ? ` ${item.unit}` : '';
      productsText += `${index + 1}. ${item.quantity}${unitDisplay} - ${item.name}\n`;
    });
    
    return replacePlaceholders(customTemplate, {
      supplier_name: supplierName,
      store_name: businessName,
      order_date: new Date().toLocaleDateString(),
      products: productsText,
      total: '' // WhatsApp typically doesn't show total
    });
  }
  
  // Fallback to default template
  let message = `${template.greeting} ${supplierName},\n\n`;
  message += `${template.intro}\n\n`;
  
  items.forEach((item, index) => {
    const unitDisplay = item.unit && item.unit.toLowerCase() !== 'pz' ? ` ${item.unit}` : '';
    message += `${index + 1}. ${item.quantity}${unitDisplay} - ${item.name}\n`;
  });
  
  message += `\n${template.closing},\n${businessName}`;
  
  return message;
}