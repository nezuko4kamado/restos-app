# Subscription Limit Control System - RESTOS Application

## Overview
This document describes the complete subscription limit control system implemented for the RESTOS application. The system tracks and enforces monthly invoice upload limits based on user subscription tiers.

## Architecture

### 1. Database Schema
The system uses the existing `user_subscriptions` table with the following key fields:
- `subscription_type`: 'free' | 'basic' | 'pro' | 'premium'
- `invoices_this_month`: Current month's invoice count
- `invoices_limit`: Maximum invoices allowed per month
- `scans_used`: Total scans used
- `scans_limit`: Maximum scans allowed
- `products_saved`: Total products saved
- `products_limit`: Maximum products allowed
- `status`: Subscription status

### 2. Subscription Tiers

| Plan | Monthly Invoices | Monthly Scans | Products | Price |
|------|-----------------|---------------|----------|-------|
| Free | 5 | 10 | 20 | €0 |
| Basic | 50 | 100 | 100 | €9.99 |
| Pro | 200 | 500 | 500 | €19.99 |
| Premium | Unlimited | Unlimited | Unlimited | €49.99 |

### 3. Core Components

#### A. SubscriptionService (`src/lib/subscriptionService.ts`)
Central service managing all subscription limit operations:

**Key Methods:**
- `getSubscriptionLimits()`: Fetches current user's subscription data
- `canUploadInvoice()`: Checks if user can upload more invoices
  - Returns: `{ allowed: boolean, reason?: string, current: number, limit: number, percentage: number }`
- `incrementInvoiceCount()`: Increments invoice counter after successful upload
- `getUsageBadgeColor(percentage)`: Returns color based on usage percentage
- `showUsageWarning(current, limit)`: Displays warning when approaching limit
- `showLimitReachedError(current, limit, onUpgrade)`: Shows error with upgrade option

**Plan Limits Constants:**
```typescript
export const PLAN_LIMITS = {
  free: { invoices: 5, scans: 10, products: 20 },
  basic: { invoices: 50, scans: 100, products: 100 },
  pro: { invoices: 200, scans: 500, products: 500 },
  premium: { invoices: -1, scans: -1, products: -1 } // -1 = unlimited
};
```

#### B. InvoiceUploadWithLimits Component (`src/components/InvoiceUploadWithLimits.tsx`)
Wrapper component that adds limit checking to the invoice upload process:

**Features:**
1. **Usage Counter Card**: Displays current usage with visual indicators
   - Shows `X / Y` format (e.g., "15 / 50")
   - Color-coded progress bar (green < 50%, yellow < 80%, red ≥ 80%)
   - Monthly reset notification

2. **Warning Alerts**: 
   - Yellow alert at 80-99% usage
   - Red alert at 100% usage with upgrade button

3. **Limit Enforcement**:
   - Blocks upload when limit reached
   - Shows upgrade dialog on attempt
   - Prevents file selection when disabled

4. **Automatic Counter Update**:
   - Increments counter after successful upload
   - Refreshes limits display
   - Shows usage warnings if approaching limit

#### C. Database Function (`supabase/migrations/20240208_add_increment_invoice_function.sql`)
PostgreSQL function to safely increment invoice count:

```sql
CREATE OR REPLACE FUNCTION increment_invoice_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET invoices_this_month = invoices_this_month + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;
```

### 4. Integration Points

#### InvoiceManagement Component
Updated to use `InvoiceUploadWithLimits` instead of `MultiPageInvoiceUpload`:

**Before:**
```tsx
<MultiPageInvoiceUpload
  onFilesSelected={handleFilesSelected}
  onConfirm={handleConfirmUpload}
  isProcessing={isProcessing}
  disabled={false}
/>
```

**After:**
```tsx
<InvoiceUploadWithLimits
  onFilesSelected={handleFilesSelected}
  onConfirm={handleConfirmUpload}
  isProcessing={isProcessing}
  disabled={false}
/>
```

### 5. User Flow

#### Upload Process:
1. User navigates to invoice upload section
2. System checks subscription limits via `canUploadInvoice()`
3. Display shows current usage (e.g., "15 / 50 invoices")
4. User selects files:
   - **If within limit**: Upload proceeds normally
   - **If at limit**: Shows upgrade dialog, blocks upload
5. After successful upload:
   - Calls `incrementInvoiceCount()` to update counter
   - Refreshes usage display
   - Shows warning if approaching limit (≥80%)

#### Limit Reached Flow:
1. User attempts to upload when at limit
2. System blocks file selection
3. Shows red alert: "Limite raggiunto!"
4. Displays upgrade dialog with plan options
5. User can:
   - Click "Annulla" to close dialog
   - Click "Visualizza Piani" to navigate to `/subscriptions`

### 6. Visual Indicators

#### Usage Badge Colors:
- **Green** (< 50%): `bg-green-100 text-green-700 border-green-300`
- **Yellow** (50-79%): `bg-yellow-100 text-yellow-700 border-yellow-300`
- **Red** (≥ 80%): `bg-red-100 text-red-700 border-red-300`

#### Progress Bar:
- **Green**: < 50% usage
- **Yellow**: 50-79% usage
- **Red**: ≥ 80% usage

### 7. Error Handling

The system handles various error scenarios:

1. **No User Logged In**:
   ```typescript
   return {
     allowed: false,
     reason: 'Impossibile verificare il piano di abbonamento',
     current: 0,
     limit: 0,
     percentage: 0
   };
   ```

2. **Database Error**:
   - Logs error to console
   - Returns null from `getSubscriptionLimits()`
   - Shows user-friendly error message

3. **Increment Failure**:
   - Logs error but doesn't block upload completion
   - User can continue using the app
   - Admin should monitor logs for issues

### 8. Monthly Reset

The invoice counter (`invoices_this_month`) should be reset monthly. This can be implemented via:

**Option A: Scheduled Supabase Function**
```sql
-- Run on 1st of each month at 00:00
CREATE OR REPLACE FUNCTION reset_monthly_invoice_counts()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_subscriptions
  SET invoices_this_month = 0,
      updated_at = NOW()
  WHERE DATE_TRUNC('month', updated_at) < DATE_TRUNC('month', NOW());
END;
$$;
```

**Option B: Cron Job**
Set up a cron job to call the reset function monthly.

### 9. Testing Checklist

- [ ] Free tier: Can upload 5 invoices, blocked at 6th
- [ ] Basic tier: Can upload 50 invoices, blocked at 51st
- [ ] Pro tier: Can upload 200 invoices, blocked at 201st
- [ ] Premium tier: Can upload unlimited invoices
- [ ] Warning shows at 80% usage
- [ ] Progress bar colors change correctly
- [ ] Counter increments after successful upload
- [ ] Upgrade dialog appears when limit reached
- [ ] Navigation to subscriptions page works
- [ ] Monthly reset works correctly

### 10. Future Enhancements

1. **Email Notifications**: Send email when user reaches 80% and 100% of limit
2. **Grace Period**: Allow 1-2 uploads over limit with warning
3. **Usage Analytics**: Track upload patterns for business insights
4. **Smart Limits**: Adjust limits based on user behavior
5. **Rollover Credits**: Allow unused invoices to roll over (premium feature)

## Deployment Notes

1. **Database Migration**: Run the SQL migration file to create the `increment_invoice_count` function
2. **Environment Variables**: Ensure Supabase credentials are configured
3. **Monitoring**: Set up logging for limit-related errors
4. **Monthly Reset**: Configure cron job or scheduled function for monthly reset

## Support

For issues or questions about the subscription limit system:
- Check logs in browser console (prefix: `[SUBSCRIPTION]`)
- Verify user's subscription status in `user_subscriptions` table
- Ensure monthly reset is running correctly
- Contact development team for assistance

---

**Last Updated**: 2024-02-08
**Version**: 1.0.0
**Author**: Development Team