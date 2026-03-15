# Deployment Guide - Restaurant Management App

This guide explains how to deploy the restaurant management application to production.

## Prerequisites

Before deploying, ensure you have:

1. **Google Gemini API Key** (for OCR/invoice scanning features)
   - Get your free API key from: https://aistudio.google.com/app/apikey
   - Required for invoice scanning and product extraction features
   
2. **Supabase Account** (optional, for cloud database)
   - Sign up at: https://supabase.com
   - Only needed if you want cloud storage instead of localStorage

## Environment Variables

The application requires the following environment variables to be configured in your deployment platform:

### Required for OCR Features

```bash
VITE_GOOGLE_API_KEY=your_google_gemini_api_key_here
```

**Important:** Without this API key, the following features will not work:
- Invoice scanning and data extraction
- Product list import from images
- Supplier information extraction
- Order creation from photos

### Optional (for Supabase)

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment Steps

### 1. Configure Environment Variables

#### For Vercel:
```bash
vercel env add VITE_GOOGLE_API_KEY
# Enter your API key when prompted
```

Or via Vercel Dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add `VITE_GOOGLE_API_KEY` with your API key
4. Add other variables if needed

#### For Netlify:
```bash
netlify env:set VITE_GOOGLE_API_KEY "your_api_key_here"
```

Or via Netlify Dashboard:
1. Go to Site settings → Environment variables
2. Add `VITE_GOOGLE_API_KEY` with your API key
3. Add other variables if needed

#### For Other Platforms:
Consult your platform's documentation on how to set environment variables. The key must be named exactly `VITE_GOOGLE_API_KEY`.

### 2. Build the Application

```bash
cd /workspace/shadcn-ui
pnpm install
pnpm run build
```

The build output will be in the `dist` directory.

### 3. Deploy

#### Vercel:
```bash
vercel --prod
```

#### Netlify:
```bash
netlify deploy --prod --dir=dist
```

#### Manual Deployment:
Upload the contents of the `dist` directory to your web server.

## Post-Deployment Checklist

After deployment, verify the following:

### ✅ Basic Functionality
- [ ] Application loads without errors
- [ ] Navigation works correctly
- [ ] Data persists in localStorage

### ✅ OCR Features (requires API key)
- [ ] Upload an invoice image
- [ ] Check if invoice data is extracted
- [ ] Verify product items are recognized
- [ ] Test price update functionality

### ✅ Error Handling
- [ ] Check browser console for any errors
- [ ] Verify error messages are user-friendly
- [ ] Test offline functionality

## Troubleshooting

### Issue: "OCR not working" or "API key error"

**Symptoms:**
- Invoice upload fails
- Console shows API errors
- "API key not configured" warnings

**Solution:**
1. Verify `VITE_GOOGLE_API_KEY` is set in your deployment platform
2. Check that the API key is valid at https://aistudio.google.com/app/apikey
3. Ensure the API key has Gemini API enabled
4. Redeploy after setting the environment variable

**Testing API Key:**
Open browser console and run:
```javascript
localStorage.getItem('app_config')
```
This should show your configuration. If the API key is missing, it means the environment variable wasn't loaded during build.

### Issue: "CORS errors"

**Symptoms:**
- API requests fail with CORS errors
- Network tab shows blocked requests

**Solution:**
This is usually not an issue with Gemini API, but if it occurs:
1. Check if your API key has domain restrictions
2. Add your deployment domain to the API key restrictions in Google Cloud Console

### Issue: "Data not persisting"

**Symptoms:**
- Data disappears after page refresh
- localStorage errors in console

**Solution:**
1. Check if browser has localStorage enabled
2. Verify browser is not in private/incognito mode
3. Check browser storage quota hasn't been exceeded

### Issue: "Slow invoice processing"

**Symptoms:**
- Invoice upload takes very long
- Timeout errors

**Solution:**
1. Reduce image size before upload (recommended: < 5MB)
2. Ensure good internet connection
3. Try a different image format (JPEG usually works best)

## API Key Management

### Security Best Practices

1. **Never commit API keys to Git**
   - API keys are in `.env.local` which is gitignored
   - Always use environment variables in production

2. **Rotate keys regularly**
   - Generate new API keys periodically
   - Update in deployment platform

3. **Monitor usage**
   - Check API usage at https://aistudio.google.com
   - Set up usage alerts if available

### API Key Restrictions (Optional)

For additional security, you can restrict your API key:

1. Go to Google Cloud Console
2. Navigate to "APIs & Services" → "Credentials"
3. Find your API key
4. Add application restrictions:
   - HTTP referrers: Add your deployment domain
   - API restrictions: Restrict to "Generative Language API"

## Scaling Considerations

### For 1000+ Users

If you're deploying for 1000+ users:

1. **Use Supabase for storage**
   - localStorage is per-user and limited
   - Supabase provides cloud database
   - Set up `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

2. **Monitor API quotas**
   - Free tier: 60 requests/minute
   - Consider upgrading to paid plan if needed

3. **Implement caching**
   - Cache OCR results to reduce API calls
   - Store processed invoices

4. **Add rate limiting**
   - Prevent abuse of OCR features
   - Implement user-based quotas

## Monitoring

### Recommended Monitoring

1. **Error Tracking**
   - Set up Sentry or similar service
   - Monitor API failures
   - Track user errors

2. **Analytics**
   - Google Analytics or Plausible
   - Track feature usage
   - Monitor performance

3. **Uptime Monitoring**
   - Use UptimeRobot or similar
   - Get alerts for downtime

## Support

### Getting Help

If you encounter issues:

1. Check browser console for errors
2. Verify all environment variables are set
3. Test API key independently
4. Check deployment platform logs

### Common Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "API key not configured" | Missing VITE_GOOGLE_API_KEY | Set environment variable and redeploy |
| "Errore API (403)" | Invalid or restricted API key | Check API key validity and restrictions |
| "Errore API (429)" | Rate limit exceeded | Wait or upgrade API plan |
| "Network error" | CORS or connectivity issue | Check internet connection and API key restrictions |

## Updating the Application

To deploy updates:

```bash
# Pull latest changes
git pull origin main

# Install dependencies
pnpm install

# Build
pnpm run build

# Deploy
vercel --prod  # or your deployment command
```

**Note:** Environment variables persist across deployments, so you don't need to reconfigure them unless they change.

## Backup and Recovery

### Backup User Data

Since data is stored in localStorage:

1. **Export functionality** is built-in
   - Users can download their data as JSON
   - Stored in browser's localStorage

2. **Supabase backup** (if using)
   - Automatic backups by Supabase
   - Point-in-time recovery available

### Recovery

If users lose data:
1. Check if they have exported backups
2. Import from JSON file
3. If using Supabase, restore from backup

## Performance Optimization

### Production Optimizations

1. **Enable compression**
   - Gzip/Brotli on server
   - Reduces bundle size

2. **CDN deployment**
   - Use Vercel/Netlify CDN
   - Faster global delivery

3. **Image optimization**
   - Compress images before upload
   - Use WebP format when possible

4. **Code splitting**
   - Already implemented with Vite
   - Lazy load routes

## Security Checklist

- [ ] API keys stored in environment variables only
- [ ] HTTPS enabled on deployment
- [ ] Content Security Policy configured
- [ ] Regular dependency updates
- [ ] API key restrictions enabled (optional)
- [ ] Rate limiting implemented (for high traffic)

## License and Credits

This application uses:
- Google Gemini API for OCR
- Supabase for optional cloud storage
- shadcn/ui for UI components

Ensure compliance with all service terms of use.