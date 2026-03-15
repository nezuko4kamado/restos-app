# 🔒 Security Notes - API Key Management

## ⚠️ IMPORTANT: Protecting Your API Keys

### What is `.env.local`?
The `.env.local` file contains sensitive configuration data like API keys. This file should **NEVER** be committed to version control (git).

### Security Checklist

✅ **DO:**
- Keep `.env.local` in your `.gitignore` file (already configured)
- Store API keys only in `.env.local`, never in code files
- Use different API keys for development and production
- Rotate (change) API keys if accidentally exposed
- Keep your API keys private and secure

❌ **DON'T:**
- Never commit `.env.local` to git
- Never share API keys in public forums or chat
- Never hardcode API keys in source code
- Never push `.env.local` to GitHub/GitLab

### Current Configuration

Your `.env.local` file contains:
- `VITE_OPENAI_API_KEY` - OpenAI API key for OCR processing
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

### If Your API Key is Exposed

If you accidentally expose your OpenAI API key:

1. **Immediately revoke the key** at https://platform.openai.com/api-keys
2. **Generate a new key** and update `.env.local`
3. **Restart your development server** to load the new key
4. **Check your billing** to ensure no unauthorized usage

### Environment Variables in Vite

Vite requires environment variables to start with `VITE_` to be accessible in the browser:
- `VITE_OCR_PROVIDER` - OCR provider selection (openai/gemini)
- `VITE_OPENAI_API_KEY` - OpenAI API key
- `VITE_GOOGLE_API_KEY` - Google Gemini API key (if using)

**Note**: Since these variables are prefixed with `VITE_`, they will be embedded in the client-side bundle. For production, consider using a backend proxy to hide API keys from the client.

### Production Deployment

For production deployments:
1. Use environment variables in your hosting platform (Vercel, Netlify, etc.)
2. Never include `.env.local` in your deployment
3. Consider implementing a backend API proxy to hide keys from client
4. Use different API keys for production vs development

### Questions?

If you have security concerns or questions about API key management, refer to:
- OpenAI Security Best Practices: https://platform.openai.com/docs/guides/safety-best-practices
- Vite Environment Variables: https://vitejs.dev/guide/env-and-mode.html