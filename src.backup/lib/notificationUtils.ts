import type { Product, Order, PriceAlert, RecurringOrderReminder, NotificationSettings } from '@/types';

export function checkPriceChanges(
  products: Product[],
  existingAlerts: PriceAlert[],
  settings: NotificationSettings
): PriceAlert[] {
  if (!settings.enable_price_alerts) return existingAlerts;

  const newAlerts: PriceAlert[] = [];
  const threshold = settings.price_change_threshold;

  products.forEach(product => {
    if (product.original_price && product.price !== product.original_price) {
      const changePercent = ((product.price - product.original_price) / product.original_price) * 100;
      
      if (Math.abs(changePercent) >= threshold) {
        // Check if alert already exists for this product
        const existingAlert = existingAlerts.find(
          a => a.product_id === product.id && !a.acknowledged
        );
        
        if (!existingAlert) {
          newAlerts.push({
            id: crypto.randomUUID(),
            product_id: product.id,
            product_name: product.name,
            old_price: product.original_price,
            new_price: product.price,
            change_percent: changePercent,
            date: new Date().toISOString(),
            acknowledged: false
          });
        }
      }
    }
  });

  return [...existingAlerts, ...newAlerts];
}

export function checkRecurringOrders(
  orders: Order[],
  existingReminders: RecurringOrderReminder[],
  settings: NotificationSettings
): RecurringOrderReminder[] {
  if (!settings.enable_recurring_reminders) return existingReminders;

  const newReminders: RecurringOrderReminder[] = [];
  const reminderDays = settings.recurring_order_reminder_days;
  const today = new Date();

  orders.forEach(order => {
    if (order.is_recurring && order.next_order_date) {
      const nextOrderDate = new Date(order.next_order_date);
      const daysUntil = Math.ceil((nextOrderDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntil <= reminderDays && daysUntil >= 0) {
        // Check if reminder already exists
        const existingReminder = existingReminders.find(
          r => r.order_id === order.id && !r.acknowledged
        );
        
        if (!existingReminder) {
          newReminders.push({
            id: crypto.randomUUID(),
            order_id: order.id,
            next_order_date: order.next_order_date,
            days_until: daysUntil,
            acknowledged: false
          });
        }
      }
    }
  });

  return [...existingReminders, ...newReminders];
}

export function getNextOrderDate(frequency: 'weekly' | 'biweekly' | 'monthly', fromDate?: Date): string {
  const date = fromDate || new Date();
  
  switch (frequency) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
  }
  
  return date.toISOString();
}