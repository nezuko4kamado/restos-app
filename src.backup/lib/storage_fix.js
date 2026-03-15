const fs = require('fs');

const filePath = './storage.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Update saveCancelledDraft function signature and implementation
content = content.replace(
  /export const saveCancelledDraft = \(orderItems: OrderItem\[\]\): void => \{/,
  'export const saveCancelledDraft = (orderItems: OrderItem[], temporaryOcrProducts?: Product[]): void => {'
);

content = content.replace(
  /console\.log\('💾 \[saveCancelledDraft\] First item:', JSON\.stringify\(orderItems\[0\], null, 2\)\);(\s+)const cancelledDraft = \{(\s+)orderItems,(\s+)timestamp: new Date\(\)\.toISOString\(\)(\s+)\};/,
  `console.log('💾 [saveCancelledDraft] First item:', JSON.stringify(orderItems[0], null, 2));
    console.log('💾 [saveCancelledDraft] temporaryOcrProducts:', temporaryOcrProducts?.length || 0);
    
    const cancelledDraft = {
      orderItems,
      temporaryOcrProducts: temporaryOcrProducts || [],
      timestamp: new Date().toISOString()
    };`
);

// Fix 2: Update getCancelledDraft function signature and return
content = content.replace(
  /export const getCancelledDraft = \(\): OrderItem\[\] \| null => \{/,
  'export const getCancelledDraft = (): { orderItems: OrderItem[]; temporaryOcrProducts: Product[] } | null => {'
);

content = content.replace(
  /console\.log\('✅ \[getCancelledDraft\] Returning', parsed\.orderItems\.length, 'items'\);(\s+)return parsed\.orderItems;/,
  `console.log('✅ [getCancelledDraft] Returning', parsed.orderItems.length, 'items');
        return {
          orderItems: parsed.orderItems,
          temporaryOcrProducts: parsed.temporaryOcrProducts || []
        };`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ storage.ts updated successfully');
