# OCR Provider Setup Guide

This application supports multiple OCR providers for invoice processing. Choose the one that works best for your region.

## Supported Providers

### 1. OpenAI GPT-4 Vision (Recommended) ✅
- **No geographic restrictions** - works globally
- Excellent OCR accuracy for invoices
- Fast and reliable
- **Cost**: ~$0.01-0.03 per invoice

**Setup:**
1. Get API key at: https://platform.openai.com/api-keys
2. Add to `.env.local`:
   ```
   VITE_OCR_PROVIDER=openai
   VITE_OPENAI_API_KEY=sk-...your-key...
   ```

### 2. Google Gemini Vision (Fallback)
- **May have geographic restrictions** in some regions
- Good OCR accuracy
- Free tier available
- **Cost**: Free for moderate use

**Setup:**
1. Get API key at: https://makersuite.google.com/app/apikey
2. Add to `.env.local`:
   ```
   VITE_OCR_PROVIDER=gemini
   VITE_GOOGLE_API_KEY=AIza...your-key...
   ```

## Quick Start

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your API keys

3. Restart the development server:
   ```bash
   pnpm run dev
   ```

## Automatic Fallback

The system automatically falls back to alternative providers if the primary one fails:
- If OpenAI fails → tries Gemini
- If Gemini has geographic restrictions → tries OpenAI

## Troubleshooting

### "Geographic restriction" error
**Solution**: Switch to OpenAI provider:
```
VITE_OCR_PROVIDER=openai
```

### "API key not configured" error
**Solution**: Make sure you've added the API key to `.env.local` and restarted the server.

### Poor OCR accuracy
**Tips**:
- Ensure invoice image is clear and well-lit
- Avoid blurry or rotated images
- Try different providers - OpenAI often has better accuracy

## Cost Comparison

| Provider | Cost per Invoice | Free Tier | Geographic Restrictions |
|----------|-----------------|-----------|------------------------|
| OpenAI   | $0.01-0.03      | $5 credit | ❌ None               |
| Gemini   | Free-$0.001     | Yes       | ⚠️ Some regions       |

## Support

For issues or questions, check the application logs in the browser console for detailed error messages.
