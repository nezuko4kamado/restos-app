# Email Template Configuration Guide

This guide explains how to configure the custom email confirmation template in your Supabase project.

## 📧 Template Overview

The `confirmation-email.html` template provides a modern, responsive email design for user registration confirmations with:

- **Modern Design**: Purple-pink gradient matching your app's branding
- **Responsive Layout**: Works perfectly on mobile and desktop devices
- **Clear CTA**: Large, prominent confirmation button
- **Feature Preview**: Shows users what they can do with their account
- **Security Notice**: Includes important security information
- **Fallback Link**: Alternative text link if button doesn't work

## 🚀 How to Configure in Supabase

### Step 1: Access Email Templates

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **Authentication** → **Email Templates** in the left sidebar

### Step 2: Select Confirmation Email Template

1. In the Email Templates section, find **Confirm signup**
2. Click on it to open the template editor

### Step 3: Replace Template Content

1. **Copy** the entire content from `confirmation-email.html`
2. **Paste** it into the Supabase template editor, replacing the existing content
3. Make sure the `{{ .ConfirmationURL }}` variable is preserved in:
   - The button `href` attribute
   - The fallback link text

### Step 4: Customize (Optional)

You can customize the template by modifying:

#### Company Information
```html
<!-- Line ~380: Footer contact email -->
<a href="mailto:support@gestioneristorante.com">support@gestioneristorante.com</a>

<!-- Line ~390: Company name and year -->
© 2025 Gestione Ristorante. Tutti i diritti riservati.
```

#### Brand Colors
The template uses these main colors:
- Primary gradient: `#9333ea` (purple) to `#ec4899` (pink)
- Background: `#f3e7ff` to `#fce7f3` (light purple-pink gradient)
- Text: `#334155` (slate gray)

#### Feature List
Update the features shown in the email (lines ~270-290):
```html
<tr>
  <td style="padding: 0 0 12px;">
    <span style="color: #22c55e; font-size: 18px; margin-right: 8px;">✓</span>
    <span style="color: #475569; font-size: 14px;">Your feature here</span>
  </td>
</tr>
```

### Step 5: Test the Email

1. Click **Save** in the Supabase template editor
2. Create a test account in your application
3. Check the email inbox for the confirmation email
4. Verify:
   - ✅ Email displays correctly on desktop
   - ✅ Email displays correctly on mobile
   - ✅ Confirmation button works
   - ✅ Fallback link works
   - ✅ All text is readable
   - ✅ Images/icons display properly

## 📱 Email Client Compatibility

The template has been tested and works with:

- ✅ Gmail (Desktop & Mobile)
- ✅ Outlook (Desktop & Web)
- ✅ Apple Mail (macOS & iOS)
- ✅ Yahoo Mail
- ✅ ProtonMail
- ✅ Thunderbird

## 🎨 Design Features

### Responsive Design
- Automatically adapts to screen size
- Maximum width: 600px for desktop
- Fluid layout for mobile devices
- Touch-friendly buttons (minimum 44px height)

### Accessibility
- Semantic HTML structure
- Proper heading hierarchy
- Sufficient color contrast (WCAG AA compliant)
- Alt text for images (if you add any)
- Readable font sizes (minimum 14px)

### Email-Safe CSS
- Inline styles for maximum compatibility
- Table-based layout (email standard)
- No external stylesheets
- No JavaScript
- Web-safe fonts with fallbacks

## 🔧 Troubleshooting

### Email Not Sending
1. Check Supabase email settings in **Project Settings** → **Auth**
2. Verify SMTP configuration if using custom SMTP
3. Check spam folder
4. Review Supabase logs for errors

### Template Not Displaying Correctly
1. Ensure all HTML is valid (no unclosed tags)
2. Check that `{{ .ConfirmationURL }}` variable is present
3. Test in multiple email clients
4. Verify inline styles are properly formatted

### Confirmation Link Not Working
1. Check that `{{ .ConfirmationURL }}` is in the `href` attribute
2. Verify redirect URLs in Supabase Auth settings
3. Check browser console for errors after clicking

## 📝 Template Variables

Supabase provides these variables for email templates:

- `{{ .ConfirmationURL }}` - The confirmation link (required)
- `{{ .Email }}` - User's email address
- `{{ .Token }}` - Confirmation token
- `{{ .TokenHash }}` - Hashed token
- `{{ .SiteURL }}` - Your site URL from Supabase settings

## 🌐 Multilingual Support

To add multilingual support to your emails:

1. Create separate templates for each language
2. Use Supabase's locale detection or
3. Implement custom logic in your application to send different templates based on user language preference

## 📚 Additional Resources

- [Supabase Email Templates Documentation](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Email Design Best Practices](https://www.campaignmonitor.com/resources/guides/email-design-best-practices/)
- [HTML Email Coding Guide](https://www.emailonacid.com/blog/article/email-development/email-development-best-practices-2/)

## 💡 Tips

1. **Always test** emails before going to production
2. **Keep it simple** - complex layouts may break in some email clients
3. **Use inline CSS** - external stylesheets don't work in emails
4. **Optimize images** - keep file sizes small for faster loading
5. **Include plain text version** - some users prefer text-only emails
6. **Monitor deliverability** - check spam scores and delivery rates

## 🆘 Support

If you encounter issues:

1. Check Supabase documentation: https://supabase.com/docs
2. Visit Supabase Discord: https://discord.supabase.com
3. Review this README for common solutions
4. Contact Supabase support through your dashboard

---

**Last Updated**: 2025-01-17
**Template Version**: 1.0.0
**Compatible with**: Supabase Auth v2+