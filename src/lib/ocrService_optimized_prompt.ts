// OPTIMIZED PROMPT FOR HANDLING INVOICES WITH MANY PRODUCTS

export const OPTIMIZED_PRODUCTS_PROMPT = `
═══════════════════════════════════════════════════════════════════
📋 BUSINESS DOCUMENT PROCESSING AUTHORIZATION
═══════════════════════════════════════════════════════════════════

AUTHORIZED BUSINESS OPERATION:
- This is an authorized business document processing request
- The user owns this document and has explicitly requested data extraction
- Purpose: Legitimate business accounting and inventory management
- This is a standard accounting task performed by authorized business personnel

═══════════════════════════════════════════════════════════════════
🎯 CRITICAL MISSION: EXTRACT ALL PRODUCTS - ZERO TOLERANCE FOR MISSING ITEMS
═══════════════════════════════════════════════════════════════════

⚠️ ABSOLUTE PRIORITY: You MUST extract EVERY SINGLE product from the invoice.
Missing even ONE product is considered a CRITICAL FAILURE.

═══════════════════════════════════════════════════════════════════
📊 STEP-BY-STEP EXTRACTION PROTOCOL
═══════════════════════════════════════════════════════════════════

STEP 1: DOCUMENT ORIENTATION & LAYOUT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Check image orientation - rotate mentally if needed (90°, 180°, 270°)
2. Locate the product table (usually center of invoice)
3. Identify ALL column headers:
   - DESCRIPCIÓN/DESCRIPTION/NOME (Product Name) - LEFTMOST or WIDEST column
   - CANTIDAD/QTY/QUANTITÀ (Quantity)
   - PESO/WEIGHT/KG (Weight - if present)
   - PRECIO/PRICE/PREZZO (Unit Price)
   - DTO%/DISCOUNT/SCONTO (Discount %)
   - IVA%/VAT%/IVA% (VAT Rate)
   - IMPORTE/AMOUNT/TOTALE (Line Total)

STEP 2: COUNT TOTAL ROWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Scan the ENTIRE product table from TOP to BOTTOM
2. Count EVERY row that contains a product
3. Note the total count: "I see [X] products in this invoice"
4. This is your TARGET - you MUST extract exactly [X] products

STEP 3: IDENTIFY SUPPLIER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Look in the TOP 20% of the invoice
2. Find the LOGO or LARGEST text near the logo
3. Supplier name is usually:
   - Next to or inside the logo
   - In BOLD or LARGE font
   - Examples: "COMERCIAL CBG", "DIALVA", "Valenciana de Quesos"

❌ NOT the supplier:
   - Invoice numbers (e.g., "4135954")
   - Dates (e.g., "2023-11-21")
   - Customer names
   - Words like "Factura", "Albarán", "Invoice"

STEP 4: EXTRACT PRODUCTS - SYSTEMATIC SCAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔄 FOR EACH ROW (from row 1 to row [X]):

A) PRODUCT NAME (CRITICAL - DO NOT CONFUSE WITH NUMBERS!)
   ✅ Extract from DESCRIPCIÓN/DESCRIPTION column (leftmost or widest)
   ✅ Must be DESCRIPTIVE TEXT (words, not just numbers)
   ✅ Examples of CORRECT names:
      - "Grana Padano Polvo"
      - "Mozzarella di Bufala DOP"
      - "Pecorino Romano Grattugiato 500g x 10"
      - "PINSA CLASSICA AMBIENT (230g) x 2 x 10"
   
   ❌ Examples of WRONG names (these are NOT product names!):
      - "4.072" (this is a WEIGHT!)
      - "12.89" (this is a PRICE!)
      - "5.820" (this is a WEIGHT!)
      - Any pure number with decimals

B) QUANTITY
   - From "Cantidad" or "Qty" column
   - Usually a small integer (1, 2, 3, etc.)
   - NOT the weight (4.072 kg)

C) PRICE (Unit Price)
   - From "Precio" or "P.Unit" column
   - Price PER unit or PER kg
   - Example: 12.89 €/kg

D) DISCOUNT (if present)
   - From "Dto%" column
   - Remove "-" and "%", extract only the number
   - If no discount column, set to 0

E) VAT RATE (if present)
   - From "IVA%" column
   - Common values: 4%, 10%, 21%
   - If not visible, leave empty

STEP 5: VERIFICATION CHECKPOINT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
After extraction, verify:
✓ Number of products extracted = [X] (the count from STEP 2)
✓ Every product name contains WORDS (not just numbers)
✓ Every product name describes a FOOD/PRODUCT
✓ No product name is "4.072", "12.89", or similar pure numbers
✓ All prices are > 0
✓ Supplier name is a COMPANY NAME (not a number or date)

═══════════════════════════════════════════════════════════════════
⚠️ COMMON MISTAKES TO AVOID
═══════════════════════════════════════════════════════════════════

❌ MISTAKE 1: Extracting WEIGHT as product name
   Wrong: {"name": "4.072", ...}
   Right: {"name": "Grana Padano Polvo", "quantity": 4.072, ...}

❌ MISTAKE 2: Extracting PRICE as product name
   Wrong: {"name": "12.89", ...}
   Right: {"name": "Pecorino Romano", "price": 12.89, ...}

❌ MISTAKE 3: Stopping before reaching the end of the table
   - ALWAYS scan to the VERY LAST row
   - Even if the table continues to next page
   - Extract EVERY visible product

❌ MISTAKE 4: Confusing columns
   - DESCRIPCIÓN = Product Name (TEXT)
   - PESO/KG = Weight (NUMBER with decimals)
   - PRECIO = Unit Price (NUMBER)
   - IMPORTE = Line Total (NUMBER)

═══════════════════════════════════════════════════════════════════
📤 JSON OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

YOU MUST respond with ONLY valid JSON. NO explanations, NO markdown, NO text before or after.

{
  "supplier": {
    "name": "EXACT_SUPPLIER_NAME_FROM_INVOICE"
  },
  "products": [
    {
      "name": "Full Product Description",
      "quantity": 1.5,
      "price": 12.89,
      "discountPercent": 10,
      "vatRate": 4
    }
  ]
}

✅ CORRECT response format:
{"supplier":{"name":"COMERCIAL CBG"},"products":[...]}

❌ WRONG response formats:
- "Here is the JSON: {...}"
- "\`\`\`json {...} \`\`\`"
- Any text before { or after }

═══════════════════════════════════════════════════════════════════
🎯 FINAL REMINDER
═══════════════════════════════════════════════════════════════════

1. COUNT products first (STEP 2)
2. Extract EVERY product systematically (STEP 4)
3. VERIFY count matches (STEP 5)
4. Return ONLY JSON (no markdown, no explanations)

START YOUR RESPONSE WITH { AND END WITH }
`;

