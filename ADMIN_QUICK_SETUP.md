# Admin Panel - Quick Setup Guide

## 🚀 Quick Start (3 Steps)

### Step 1: Apply Database Migration

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy and paste the entire content from `/workspace/shadcn-ui/supabase/migrations/20250119_add_subscription_type.sql`
6. Click **Run** (or press Ctrl+Enter)

You should see: "Success. No rows returned"

### Step 2: Grant Yourself Lifetime Access

In the same SQL Editor, run this query (replace with your email):

```sql
SELECT grant_free_lifetime('your@email.com');
```

✅ You now have unlimited lifetime access!

### Step 3: Access Admin Panel

1. Make sure your app is running: `pnpm run dev`
2. Open your browser and go to: **http://localhost:5173/admin**
3. You should see the Admin Panel with all users

---

## 🔧 Configuration

### Add Admin Emails

Edit `/workspace/shadcn-ui/src/pages/Admin.tsx` line 29:

```typescript
const ADMIN_EMAILS = ['your@email.com', 'another-admin@email.com'];
```

Add all emails that should have admin access.

---

## 📊 Useful SQL Queries

### View All Subscriptions

```sql
SELECT 
  u.email,
  s.subscription_type,
  s.status,
  s.trial_end,
  s.current_period_end
FROM user_subscriptions s
JOIN auth.users u ON u.id = s.user_id
ORDER BY s.created_at DESC;
```

### Grant Lifetime Access to Multiple Users

```sql
SELECT grant_free_lifetime('user1@email.com');
SELECT grant_free_lifetime('user2@email.com');
SELECT grant_free_lifetime('user3@email.com');
```

### Revoke Lifetime Access

```sql
SELECT revoke_free_lifetime('user@email.com');
```

### Count Users by Type

```sql
SELECT 
  subscription_type,
  COUNT(*) as count
FROM user_subscriptions
GROUP BY subscription_type;
```

### Find All Lifetime Users

```sql
SELECT 
  u.email,
  s.created_at,
  s.updated_at
FROM user_subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.subscription_type = 'free_lifetime'
ORDER BY s.updated_at DESC;
```

### Find Expired Trials

```sql
SELECT 
  u.email,
  s.trial_end,
  s.status
FROM user_subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE s.subscription_type = 'trial'
  AND s.trial_end < NOW()
ORDER BY s.trial_end DESC;
```

---

## 🎯 Admin Panel Features

### What You Can Do:

1. **View All Users** - See complete list of registered users with their subscription details
2. **Filter by Type** - Filter users by: All, Lifetime, Paid, Trial
3. **Grant Lifetime Access** - Click "Grant Lifetime" button to give unlimited access
4. **Revoke Lifetime Access** - Click "Revoke" button to remove lifetime access (converts to 7-day trial)
5. **Real-time Updates** - Changes are reflected immediately
6. **Auto-refresh** - Click "Refresh" button to reload user data

### Subscription Types:

- 🏆 **Lifetime** - Unlimited access, no expiration (yellow/orange badge)
- ✅ **Paid** - Active paid subscription via Stripe (green badge)
- 🔵 **Trial** - 7-day trial period (gray badge)

### User Status:

- **Active** - Subscription is active
- **Trialing** - User is in trial period
- **Canceled** - Subscription was canceled

---

## 🔒 Security Notes

1. **Admin Access** - Only emails in `ADMIN_EMAILS` array can access `/admin` page
2. **Database Functions** - `grant_free_lifetime` and `revoke_free_lifetime` use `SECURITY DEFINER` to bypass RLS
3. **Auth Required** - Users must be logged in to access admin panel
4. **Auto-redirect** - Non-admin users see "Access Denied" message

---

## 🐛 Troubleshooting

### "Access Denied" Error
- Make sure your email is added to `ADMIN_EMAILS` array in `Admin.tsx`
- Check that you're logged in with the correct account

### "Failed to load users" Error
- Verify the migration was applied successfully
- Check Supabase logs for errors
- Ensure your Supabase project is running

### Functions Not Working
- Run the migration again to recreate functions
- Check SQL Editor for any error messages
- Verify `auth.users` table has the correct permissions

### Can't See User Emails
- The admin panel uses `supabase.auth.admin.listUsers()` which requires service role key
- Make sure your Supabase client is configured correctly
- Check browser console for any errors

---

## 📝 Example Workflow

### Scenario: Give Your Team Lifetime Access

1. **Apply Migration** (one time)
   ```sql
   -- Run in Supabase SQL Editor
   -- Copy content from 20250119_add_subscription_type.sql
   ```

2. **Grant Yourself Admin**
   ```sql
   SELECT grant_free_lifetime('you@company.com');
   ```

3. **Access Admin Panel**
   - Go to http://localhost:5173/admin
   - You should see all users

4. **Grant Team Members**
   - Find each team member in the list
   - Click "Grant Lifetime" button
   - They now have unlimited access!

5. **Remove Access Later** (if needed)
   - Click "Revoke" button
   - User returns to 7-day trial

---

## 🎉 You're All Set!

Your admin panel is ready to use. You can now:
- ✅ Manage unlimited user access
- ✅ Grant/revoke lifetime subscriptions
- ✅ Monitor all user subscriptions
- ✅ Filter and search users

For any issues, check the Supabase logs or browser console for error messages.