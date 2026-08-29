# Requirements & Progress

## Requirements Overview
RESTOS web app for restaurant managers: automate invoice OCR processing, manage suppliers/products/orders, track price changes, handle subscriptions (Stripe), multilingual UI (IT/EN), WhatsApp order messages.

## User Stories
- As a restaurant manager, I can upload invoices and have data extracted automatically via OCR
- As a user, I can manage suppliers and products without duplicates
- As a user, I receive alerts when product prices change significantly
- As a user, I can send orders via WhatsApp with correct product units
- As a subscriber, I have limits on products/invoices/orders based on my plan
- As an admin, I can view monthly expense reports

## Task Breakdown
- [x] OCR invoice processing (Klippa + Google Doc AI)
- [x] Product management with deduplication
- [x] Supplier management
- [x] Price change notifications
- [x] Stripe subscription integration
- [x] Multilingual support (i18n)
- [x] WhatsApp order message fix (no default kg unit)
- [x] Fix supplier duplicates (raise fuzzy threshold to 75%)
- [x] Fix multi-photo OCR freeze + reset isProcessing
- [x] Fix price alerts widget (include price drops)
- [x] Fix camera on Android (native input, no getUserMedia)
- [x] Two upload buttons (camera + gallery) in all sections
- [x] Discount badge computed from unit_price/discounted_price fallback
- [x] Bump SW cache to v4 to force cache invalidation on all clients

## Progress Log
- 2026-04-13 | Project scaffolded: React/TS + Supabase + Stripe + i18n setup
- 2026-04-13 | WhatsApp button fixed; product deduplication logic added
- 2026-04-17 | Month/year filters, dynamic summary cards, discount price display fixes
- 2026-04-20 | Automatic price change notifications implemented
- 2026-04-27 | Date guard for invoices added then removed
- 2026-04-28 | Supplier whitelist table added; price history and product matching improved; supplier-scoped matching enforced
- 2026-04-29 | Code description persistence improved; previous price tracking added; DB columns added
- 2026-04-30 | Storage fix restored; language selector restored
- 2026-05-01 | Price tracking and update logic fixed; product matching improved
- 2026-05-02 | Invoice price update and product matching logic fixed
- 2026-05-04 | Login infinite loading fixed; false price alert fixed; debounce for supplier auto-save; products upsert 400 error fixed; upload button fixed; DB structure fixes
- 2026-05-08 | Auto-save loop fixed; SQL migration applied; missing DB columns added; build deployed
- 2026-05-11 | White screen on Suppliers page fixed (missing useRef import); WhatsApp unit display fixed (no default kg)
- 2026-05-25 | Fuzzy threshold raised to 75% to fix supplier duplicate issue; pushed to GitHub
- 2026-05-25 | Fixed SupplierMatcher.matchSupplier call signature in SuppliersSection.tsx (wrong args + wrong result fields); build OK; pushed to GitHub
- 2026-05-25 | Fixed supplier_id hardcoded to '' in getInvoices (storage.ts); now reads dbInvoice.supplier_id; build OK; pushed to GitHub
- 2026-06-28 | Updated Stripe price IDs and prices (Basic 4.99, Pro 9.99, Premium 14.99); build OK; push blocked (GitHub token expired)
- 2026-08-24 | Fixed WhatsApp deep link on Android (window.location.href for whatsapp:// scheme); build OK; push blocked (GitHub token expired/invalid)
- 2026-08-25 | Fixed buildWhatsAppUrl: removed isMobile userAgent check, always use whatsapp:// deep link + wa.me fallback after 2s; pushed to GitHub (commit 3d3f90c)
- 2026-08-26 | Fixed multi-photo OCR freeze: itemsData.items bug (extractInvoiceItems returns array directly) + added finally block to always reset isProcessing; pushed to GitHub (commit 354b82f)
- 2026-08-26 | Fixed price alerts widget: now uses pre-calculated alerts from Index.tsx instead of separate DB table; added price drop detection (not only increases); pushed to GitHub (commit 426b51e)
- 2026-08-26 | Fixed camera not opening on Android: replaced getUserMedia/CameraCapture with two separate native inputs (capture=environment for camera, no capture for gallery); pushed to GitHub (commit 0264030)
- 2026-08-26 | Refactored MultiPageInvoiceUpload: removed all ref/.click() calls, all buttons now use label+input native pattern; fixed \x08 control char in storage.ts regex (replaced with \b); lint OK, build OK; pushed to GitHub (commit 83ba31a)
- 2026-08-26 | Fixed two-button upload UI (camera + gallery) in ProductsSectionEnhanced, SupplierDetail, MultiPageInvoiceUpload; added takePhoto/selectPhoto i18n keys to all 6 locales (IT/EN/ES/DE/FR/LT) and i18n.tsx type; MultiPageInvoiceUpload now uses useLanguage() for full i18n; lint OK, build OK; pushed to GitHub (commit 7f200ef)
- 2026-08-26 | Fixed upload buttons layout to 2-row grid and discount badge computed from unit_price vs discounted_price; pushed commit 58362d4
- 2026-08-29 | Rimossi useRef inutilizzati da ProductsSectionEnhanced, MultiPageInvoiceUpload e SupplierDetail (camera ora usa label+input nativi); lint OK, build OK
- 2026-08-27 | Ripristinato tab "Informe mensual" (📊) nella sezione Fatture: aggiunto terzo tab con AllInvoicesView in InvoiceManagement.tsx; build OK; pushed commit d5ffa7c
- 2026-08-27 | Bump SW cache v6 + vercel.json no-cache headers per sw.js e index.html per forzare aggiornamento su Android/TWA; pushed commit 033eb2e
- 2026-08-26 | BUG1 fix: dbProductsMap separato per confronto prezzi (oldPrice da DB fresco, non da stato React locale); BUG2 fix: overflow-hidden->overflow-x-hidden + CardHeader overflow-visible per visibilità pulsanti camera/gallery; lint OK, build OK
- 2026-08-26 | Fixed product duplicate on invoice upload: matching P1/P2/P3/P4 now case-insensitive (.trim().toLowerCase()) to handle OCR code/name case variations; pushed commit 93626e5
- 2026-08-26 | Fixed price not updating after match: getProductsBySupplier now fetches unit_price/discounted_price/discount fields; reduced batch fetch from 2 DB calls to 1 (speed fix); pushed commit 1df3b34
- 2026-08-26 | Fixed price still not updating: allKnownProducts now uses DB data only (no local React state override) so oldPrice reflects real saved value; added PRICE DEBUG log; pushed commit 4f0b4d3
- 2026-08-26 | Reverted batch fetch to original 2-query + local state wins merge (commit 4f0b4d3 broke price update); pushed commit c840020
- 2026-08-26 | Bumped SW cache version to v4 to force cache invalidation on all Android/TWA clients; build OK; pushed to GitHub (commit d14f5f0)
- 2026-08-27 | Fix price update logic: rimosso dbProductsMap, oldPrice da stato locale, semplificato priceActuallyChanged, rimosso "Confirmed from invoice" da priceHistory; lint OK, build OK; pushed commit ae85c37
- 2026-08-27 | Ripristinata logica prezzi originale da commit 93626e5: BATCH FETCH, oldPrice=existingProduct.price, priceActuallyChanged=Math.abs>0.001, "Confirmed from invoice" in priceHistory; lint OK, build OK; pushed commit c2a1910
- 2026-08-27 | Ripristinata logica prezzi al commit ae85c37 per test utente (APK aggiornata, pulsanti visibili); build OK; pushed commit 910b6c8
- 2026-08-27 | Fix camera Android: sostituito className="hidden" con "sr-only" su tutti gli input file in ProductsSectionEnhanced.tsx e MultiPageInvoiceUpload.tsx; build OK; pushed commit 61ffb49
- 2026-08-29 | Fix camera Android DEFINITIVO: sostituito pattern label+htmlFor con useRef+.click() programmatico in ProductsSectionEnhanced, MultiPageInvoiceUpload (3 punti) e SupplierDetail; lint OK, build OK; pushed commit 472cc3c
- 2026-08-29 | BUG1: aggiunto tab "Informe mensual" (📊) in InvoicesSection.tsx con riepilogo mensile (count/totale/pagato/non pagato); BUG2: aggiunto fallback supplier_name in getSupplierInvoices per correggere contatore = 0; lint OK, build OK; pushed commit e2711b8
- 2026-08-29 | Revert InvoicesSection.tsx: rimosso tab Informe mensual (non gradito dall'utente), ripristinata vista originale senza Tabs; fallback supplier_name in SuppliersSection.tsx mantenuto; lint OK, build OK; pushed commit 573252f