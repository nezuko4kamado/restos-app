import fs from 'fs';

const filePath = './OrdersSection.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Update handleCopyLastOrder to handle the new return type from getCancelledDraft
content = content.replace(
  /const cancelledDraft = await getCancelledDraft\(\);[\s\S]*?console\.log\('📋 getCancelledDraft\(\) returned:', cancelledDraft\);[\s\S]*?if \(cancelledDraft && Array\.isArray\(cancelledDraft\) && cancelledDraft\.length > 0\) \{[\s\S]*?const validItems = cancelledDraft\.filter\(item =>/,
  `const cancelledDraft = await getCancelledDraft();
    console.log('📋 getCancelledDraft() returned:', cancelledDraft);
    
    if (cancelledDraft && cancelledDraft.orderItems && Array.isArray(cancelledDraft.orderItems) && cancelledDraft.orderItems.length > 0) {
      console.log('✅ Found cancelled draft with', cancelledDraft.orderItems.length, 'items');
      
      // Validate each item has required fields
      const validItems = cancelledDraft.orderItems.filter(item =>`
);

// Fix 2: Update the part where we restore temporaryOcrProducts
content = content.replace(
  /if \(validItems\.length > 0\) \{[\s\S]*?setOrderItems\(validItems\);[\s\S]*?setIsCreatingOrder\(true\);[\s\S]*?await clearCancelledDraft\(\);[\s\S]*?setHasCancelledDraft\(false\);/,
  `if (validItems.length > 0) {
        setOrderItems(validItems);
        setIsCreatingOrder(true);
        
        // Restore temporary OCR products if they exist
        if (cancelledDraft.temporaryOcrProducts && cancelledDraft.temporaryOcrProducts.length > 0) {
          setTemporaryOcrProducts(cancelledDraft.temporaryOcrProducts);
          console.log('✅ Restored', cancelledDraft.temporaryOcrProducts.length, 'temporary OCR products');
        }
        
        await clearCancelledDraft();
        setHasCancelledDraft(false);`
);

// Fix 3: Update handleCancelOrder to pass temporaryOcrProducts
content = content.replace(
  /await saveCancelledDraft\(orderItems, temporaryOcrProducts\);/,
  'await saveCancelledDraft(orderItems, temporaryOcrProducts);'
);

// Make sure the call exists, if not add it
if (!content.includes('await saveCancelledDraft(orderItems, temporaryOcrProducts)')) {
  content = content.replace(
    /await saveCancelledDraft\(orderItems\);/,
    'await saveCancelledDraft(orderItems, temporaryOcrProducts);'
  );
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ OrdersSection.tsx updated successfully');
