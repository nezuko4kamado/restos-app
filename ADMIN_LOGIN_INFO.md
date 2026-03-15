# Admin Panel Login

## 🔐 Access Information

### Login URL
- **Development**: http://localhost:5173/admin/login
- **Production**: https://your-domain.com/admin/login

### Default Credentials
- **Username**: `admin`
- **Password**: `MGX2025!Admin`

## ✨ Features

### Session Management
- ✅ Session expires after **24 hours**
- ✅ Automatic redirect to login if session expired
- ✅ Logout button in admin panel header
- ✅ Session stored in localStorage

### Security
- 🔒 Independent from user authentication system
- 🔒 No email-based access control
- 🔒 Dedicated admin credentials
- 🔒 Session validation on every page load

### Admin Panel Capabilities
Once logged in, you can:
- 👥 View all registered users
- 🔍 Filter users by subscription type (All, Lifetime, Paid, Trial)
- ✅ Grant lifetime access to any user
- ❌ Revoke lifetime access from users
- 📊 See subscription details (trial end, period end)
- 🔄 Refresh user data manually

## 🚀 Quick Start

### Step 1: Access Login Page
Navigate to: `http://localhost:5173/admin/login`

### Step 2: Enter Credentials
- Username: `admin`
- Password: `MGX2025!Admin`

### Step 3: Manage Users
After successful login, you'll be redirected to the admin panel where you can manage all user subscriptions.

## 🔧 Configuration

### Change Admin Password
Edit `/workspace/shadcn-ui/src/pages/AdminLogin.tsx`:

```typescript
const ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'YOUR_NEW_PASSWORD_HERE'
};
```

### Add Multiple Admin Accounts
You can extend the system to support multiple admin accounts by modifying the authentication logic in `AdminLogin.tsx`.

### Session Duration
To change session expiration time, edit `/workspace/shadcn-ui/src/pages/Admin.tsx`:

```typescript
// Current: 24 hours
const twentyFourHours = 24 * 60 * 60 * 1000;

// Example: 12 hours
const twelveHours = 12 * 60 * 60 * 1000;
```

## 🛡️ Security Notes

### For Development
- ✅ Current setup is suitable for development and testing
- ✅ Credentials are hardcoded for simplicity
- ✅ Session stored in localStorage

### For Production
⚠️ **Important**: Before deploying to production, implement:

1. **Backend Authentication**
   - Move credentials to environment variables
   - Implement proper password hashing (bcrypt, argon2)
   - Use JWT tokens instead of localStorage
   - Add rate limiting to prevent brute force attacks

2. **HTTPS Only**
   - Ensure admin panel is only accessible via HTTPS
   - Use secure cookies for session management

3. **Additional Security Layers**
   - Two-factor authentication (2FA)
   - IP whitelisting
   - Audit logging for admin actions
   - Password complexity requirements
   - Account lockout after failed attempts

4. **Environment Variables**
   ```env
   VITE_ADMIN_USERNAME=your_admin_username
   VITE_ADMIN_PASSWORD=your_secure_hashed_password
   ```

## 📝 Usage Examples

### Grant Lifetime Access
1. Login to admin panel
2. Find the user in the table
3. Click the green "Grant Lifetime" button
4. User will immediately have unlimited access

### Revoke Lifetime Access
1. Login to admin panel
2. Find the user with "Lifetime" badge
3. Click the red "Revoke" button
4. User will return to trial status (7 days)

### Filter Users
Use the dropdown filter to view:
- **All Users**: Complete list
- **Lifetime**: Users with unlimited access
- **Paid**: Users with active paid subscriptions
- **Trial**: Users in trial period

## 🔄 Session Management

### Auto-Logout
- Session automatically expires after 24 hours
- User is redirected to login page
- Toast notification shows "Session expired"

### Manual Logout
- Click "Logout" button in admin panel header
- Session is cleared from localStorage
- Redirected to login page

### Session Validation
- Checked on every page load
- Validates timestamp and authentication status
- Redirects to login if invalid or expired

## 🐛 Troubleshooting

### "Access Denied" Error
- Make sure you're using the correct credentials
- Check if session has expired (24 hours)
- Clear localStorage and try again

### Can't See Users
- Ensure Supabase connection is working
- Check if migration `20250119_add_subscription_type.sql` is applied
- Verify RLS policies allow admin access

### Session Keeps Expiring
- Check your system time is correct
- Verify localStorage is not being cleared by browser
- Consider increasing session duration in code

## 📞 Support

If you need help:
1. Check the browser console for errors
2. Verify Supabase configuration
3. Ensure all migrations are applied
4. Review the code in `AdminLogin.tsx` and `Admin.tsx`

---

**Last Updated**: 2025-01-19
**Version**: 1.0.0