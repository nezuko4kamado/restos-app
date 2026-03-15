import pg from 'pg';
const { Client } = pg;

// Try different regions for Supabase pooler
const regions = ['eu-central-1', 'us-east-1', 'eu-west-1', 'us-west-1', 'ap-southeast-1'];
const projectRef = 'tmxmkvinsvuzbzrjrucw';
const password = 'YOUR_SUPABASE_DB_PASSWORD';

const sql = `
-- 1. increment_scan_count
CREATE OR REPLACE FUNCTION increment_scan_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET scans_used = scans_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION increment_scan_count(UUID) TO authenticated;

-- 2. increment_product_count
CREATE OR REPLACE FUNCTION increment_product_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE user_subscriptions
  SET products_saved = products_saved + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id;
END;
$$;
GRANT EXECUTE ON FUNCTION increment_product_count(UUID) TO authenticated;

-- 3. increment_invoice_count
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
GRANT EXECUTE ON FUNCTION increment_invoice_count(UUID) TO authenticated;
`;

async function tryConnect(region) {
  // Try both direct and pooler connections
  const urls = [
    `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:6543/postgres`,
    `postgresql://postgres.${projectRef}:${password}@aws-0-${region}.pooler.supabase.com:5432/postgres`,
    `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
  ];
  
  for (const url of urls) {
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 8000, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      console.log(`✅ Connected via: ${region} (${url.includes('pooler') ? 'pooler' : 'direct'})`);
      return client;
    } catch (err) {
      // silent, try next
    }
  }
  return null;
}

async function main() {
  // Try direct connection first (no region needed)
  const directUrl = `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`;
  const directClient = new Client({ connectionString: directUrl, connectionTimeoutMillis: 10000, ssl: { rejectUnauthorized: false } });
  
  try {
    await directClient.connect();
    console.log('✅ Connected directly to Supabase database');
    await directClient.query(sql);
    console.log('✅ All 3 functions created successfully!');
    await directClient.end();
    return;
  } catch (err) {
    console.log('Direct connection failed:', err.message);
  }

  // Try pooler connections across regions
  for (const region of regions) {
    const client = await tryConnect(region);
    if (client) {
      try {
        await client.query(sql);
        console.log('✅ All 3 functions created successfully!');
        await client.end();
        return;
      } catch (err) {
        console.error('SQL execution error:', err.message);
        await client.end();
      }
    }
  }
  
  console.error('❌ Could not connect to database in any region');
  process.exit(1);
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
