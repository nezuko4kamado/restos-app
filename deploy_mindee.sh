#!/bin/bash
echo "🚀 Deploying Mindee Edge Function..."

# Create deployment package
mkdir -p /tmp/mindee_deploy
cp supabase/functions/mindee_only/index.ts /tmp/mindee_deploy/

# Use curl to deploy via Supabase Management API
curl -X POST \
  "https://api.supabase.com/v1/projects/tmxmkvinsvuzbzrjrucw/functions" \
  -H "Authorization: Bearer sbp_b99e88a11dc1b0c19d71f55b3ffd7fbd6c3090a8" \
  -H "Content-Type: application/json" \
  -d @- << JSON
{
  "slug": "mindee_only",
  "name": "Mindee Only OCR",
  "source": "$(base64 -w 0 /tmp/mindee_deploy/index.ts)",
  "verify_jwt": false,
  "import_map": {},
  "entrypoint": "index.ts"
}
JSON

echo "📋 Setting up Mindee API Key in Supabase secrets..."
curl -X POST \
  "https://api.supabase.com/v1/projects/tmxmkvinsvuzbzrjrucw/secrets" \
  -H "Authorization: Bearer sbp_b99e88a11dc1b0c19d71f55b3ffd7fbd6c3090a8" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MINDEE_API_KEY",
    "value": "md_C4Hd59R9iYnkifUCnIr5x1SQumT4Nbj_9GQbpkGHlro"
  }'

echo "✅ Deployment completed!"
