# 🧪 Testing Guide - Subscription Features

This guide explains how to test subscription features without waiting for the 7-day trial to expire.

## 📋 Prerequisites

- You must be logged in to the application
- Open the browser console (F12 or Right-click → Inspect → Console tab)

## 🛠️ Available Test Commands

The test utilities are available in the browser console as `testSub`:

### 1. **Check Current Status**
```javascript
testSub.getStatus()
```
Shows your current subscription status including:
- User ID and email
- Subscription status (trialing, active, canceled, etc.)
- Subscription type (trial, paid, free_lifetime)
- Start and end dates
- Days remaining
- Whether expired or not

### 2. **Expire Trial Immediately**
```javascript
testSub.expireTrial()
```
Sets the trial end date to yesterday, immediately expiring your trial.

**What happens:**
- Trial end date is set to yesterday
- After page refresh, you'll see blocked features
- Upload buttons will be disabled
- Prominent "Activate Subscription" buttons will appear

### 3. **Reset Trial to 7 Days**
```javascript
testSub.resetTrial()
```
Resets your trial to 7 days from now.

**What happens:**
- Trial is extended for 7 more days
- Status changes to "trialing"
- After page refresh, all features are accessible again

### 4. **Activate Paid Subscription**
```javascript
testSub.activatePaidSubscription()
```
Simulates a successful payment and activates a paid subscription.

**What happens:**
- Status changes to "active"
- Type changes to "paid"
- Subscription is valid for 1 month
- All features are unlocked indefinitely (until subscription expires)

## 📝 Testing Workflow

### Test Scenario 1: Trial Expiration

1. **Open browser console** (F12)
2. **Check current status:**
   ```javascript
   testSub.getStatus()
   ```
3. **Expire the trial:**
   ```javascript
   testSub.expireTrial()
   ```
4. **Refresh the page** (F5 or Ctrl+R)
5. **Verify blocked features:**
   - Go to "Ordini" section
   - Try to click "Importa da Foto" → Should be disabled
   - Try to add products manually → Section should be grayed out
   - You should see a red warning box with "Attiva Abbonamento" button
6. **Go to "Prodotti" section:**
   - Try to click "Aggiungi Prodotto" → Should be disabled
   - Try to click "Carica Fattura" → Should be disabled
   - You should see a red warning box with "Attiva Abbonamento" button

### Test Scenario 2: Subscription Activation

1. **With expired trial, click "Attiva Abbonamento" button**
2. **Expected behavior:**
   - If Stripe is configured: Redirects to Stripe checkout
   - If Stripe is NOT configured: Shows error toast
3. **Simulate payment success:**
   ```javascript
   testSub.activatePaidSubscription()
   ```
4. **Refresh the page**
5. **Verify all features are unlocked:**
   - All upload buttons should be enabled
   - No warning boxes should appear
   - You can add products and upload invoices

### Test Scenario 3: Reset After Testing

1. **Reset trial to clean state:**
   ```javascript
   testSub.resetTrial()
   ```
2. **Refresh the page**
3. **Verify trial is active again:**
   ```javascript
   testSub.getStatus()
   ```

## ⚠️ Important Notes

### Development Only
- These utilities are for **development and testing only**
- Do NOT use in production with real user accounts
- Changes are made directly to the database

### Refresh Required
- **Always refresh the page** after running any test command
- The subscription state is loaded on page mount
- Changes won't be visible until you refresh

### Database Changes
- All commands modify the `user_subscriptions` table directly
- Changes are permanent until you run another command
- Use `resetTrial()` to restore normal state

### Error Handling
- If you see errors, check the console for details
- Make sure you're logged in
- Verify Supabase connection is working

## 🎯 What to Test

### Features That Should Be Blocked (Expired Trial)
- ❌ Upload invoice photos (OCR) in Orders
- ❌ Add products manually in Orders
- ❌ Add new products in Products section
- ❌ Upload invoices in Products section
- ❌ Access Settings

### Features That Should Still Work (Expired Trial)
- ✅ View existing orders
- ✅ View existing products
- ✅ Search products
- ✅ Export products to Excel/PDF
- ✅ Send orders via WhatsApp/Email (existing orders)

### UI Elements to Verify
- 🔴 Red warning boxes with lock icon
- 🟢 Green "Attiva Abbonamento" buttons
- 🔒 Disabled buttons with proper styling
- 💬 Clear error messages

## 🐛 Troubleshooting

### Commands Not Working
```javascript
// Check if utilities are loaded
console.log(window.testSub)
// Should show object with functions
```

### No Changes After Refresh
```javascript
// Check subscription in database
testSub.getStatus()
// Verify the dates are correct
```

### Stripe Errors
- If you see "STRIPE_NOT_CONFIGURED" error, this is expected
- Stripe integration requires environment variables
- The test utilities work independently of Stripe

## 📞 Support

If you encounter issues:
1. Check browser console for error messages
2. Verify you're logged in
3. Try logging out and back in
4. Clear browser cache and reload

---

**Happy Testing! 🎉**