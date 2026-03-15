import { OrderItem, OrderBySupplier, Supplier } from '@/types';
import { t } from '@/lib/i18n';

export function groupOrdersBySupplier(
  items: OrderItem[],
  suppliers: Supplier[]
): OrderBySupplier[] {
  const supplierMap = new Map<string, OrderBySupplier>();

  items.forEach((item) => {
    if (!item.supplierId) return;

    const supplier = suppliers.find((s) => s.id === item.supplierId);
    if (!supplier) return;

    if (!supplierMap.has(item.supplierId)) {
      supplierMap.set(item.supplierId, {
        supplierId: item.supplierId,
        supplierName: supplier.name,
        supplierPhone: supplier.phone,
        items: [],
        total: 0,
      });
    }

    const supplierOrder = supplierMap.get(item.supplierId)!;
    supplierOrder.items.push(item);
    supplierOrder.total += item.price * item.quantity;
  });

  return Array.from(supplierMap.values());
}

export function generateWhatsAppMessage(order: OrderBySupplier): string {
  let message = `${t('whatsappGreeting')} ${order.supplierName},\n\n`;
  message += `${t('whatsappOrderIntro')}\n\n`;

  order.items.forEach((item, index) => {
    message += `${index + 1}. ${item.productName}\n`;
    message += `   ${t('quantity')}: ${item.quantity}\n\n`;
  });

  message += `${t('whatsappThanks')}`;

  return message;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export function generateEmailMessage(order: OrderBySupplier): { subject: string; body: string } {
  const subject = `Nuovo Ordine - ${new Date().toLocaleDateString('it-IT')}`;
  
  let body = `Gentile ${order.supplierName},\n\n`;
  body += `Vi inviamo il seguente ordine:\n\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  order.items.forEach((item, index) => {
    body += `${index + 1}. ${item.productName}\n`;
    body += `   Quantità: ${item.quantity}\n`;
    body += `   Prezzo unitario: €${item.price.toFixed(2)}\n`;
    body += `   Subtotale: €${(item.price * item.quantity).toFixed(2)}\n\n`;
  });

  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  body += `TOTALE ORDINE: €${order.total.toFixed(2)}\n\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  body += `Vi preghiamo di confermare la disponibilità e i tempi di consegna.\n\n`;
  body += `Cordiali saluti`;

  return { subject, body };
}