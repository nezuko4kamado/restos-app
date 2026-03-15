import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function log(requestId: string, level: string, message: string) {
  console.log(`[${new Date().toISOString()}] [${requestId}] [${level}] ${message}`)
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  log(requestId, 'INFO', '🗑️ DELETE USER - Starting account deletion')

  try {
    // Get the authorization header to identify the user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing Authorization header')
    }

    // Create a Supabase client with the user's JWT to get the user info
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!supabaseServiceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    })

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()

    if (userError || !user) {
      log(requestId, 'ERROR', `❌ Failed to get user: ${userError?.message || 'No user found'}`)
      throw new Error('Unauthorized: Could not verify user identity')
    }

    const userId = user.id
    log(requestId, 'INFO', `👤 User identified: ${userId} (${user.email})`)

    // Create admin client with service role key for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // =========================================================================
    // DELETE USER DATA FROM ALL TABLES (order matters due to foreign keys!)
    // =========================================================================
    // Order:
    // 1. app_43909_price_history (has FK to app_43909_invoices AND auth.users)
    // 2. app_43909_invoices (has FK to auth.users)
    // 3. app_43909_supplier_whitelist (has FK to auth.users)
    // 4. user_subscriptions (has FK to auth.users with ON DELETE CASCADE, but delete explicitly to be safe)
    // 5. Then delete from auth.users

    // Step 1: Delete price_history (child of invoices)
    log(requestId, 'INFO', '📋 [1/4] Deleting app_43909_price_history...')
    const { error: priceHistoryError, count: priceHistoryCount } = await supabaseAdmin
      .from('app_43909_price_history')
      .delete({ count: 'exact' })
      .eq('user_id', userId)

    if (priceHistoryError) {
      log(requestId, 'WARNING', `⚠️ Error deleting app_43909_price_history: ${priceHistoryError.message}`)
    } else {
      log(requestId, 'SUCCESS', `✅ app_43909_price_history deleted (${priceHistoryCount ?? 0} rows)`)
    }

    // Step 2: Delete invoices
    log(requestId, 'INFO', '📋 [2/4] Deleting app_43909_invoices...')
    const { error: invoicesError, count: invoicesCount } = await supabaseAdmin
      .from('app_43909_invoices')
      .delete({ count: 'exact' })
      .eq('user_id', userId)

    if (invoicesError) {
      log(requestId, 'WARNING', `⚠️ Error deleting app_43909_invoices: ${invoicesError.message}`)
    } else {
      log(requestId, 'SUCCESS', `✅ app_43909_invoices deleted (${invoicesCount ?? 0} rows)`)
    }

    // Step 3: Delete supplier_whitelist
    log(requestId, 'INFO', '📋 [3/4] Deleting app_43909_supplier_whitelist...')
    const { error: whitelistError, count: whitelistCount } = await supabaseAdmin
      .from('app_43909_supplier_whitelist')
      .delete({ count: 'exact' })
      .eq('user_id', userId)

    if (whitelistError) {
      log(requestId, 'WARNING', `⚠️ Error deleting app_43909_supplier_whitelist: ${whitelistError.message}`)
    } else {
      log(requestId, 'SUCCESS', `✅ app_43909_supplier_whitelist deleted (${whitelistCount ?? 0} rows)`)
    }

    // Step 4: Delete user_subscriptions
    log(requestId, 'INFO', '📋 [4/4] Deleting user_subscriptions...')
    const { error: subError, count: subCount } = await supabaseAdmin
      .from('user_subscriptions')
      .delete({ count: 'exact' })
      .eq('user_id', userId)

    if (subError) {
      log(requestId, 'WARNING', `⚠️ Error deleting user_subscriptions: ${subError.message}`)
    } else {
      log(requestId, 'SUCCESS', `✅ user_subscriptions deleted (${subCount ?? 0} rows)`)
    }

    // =========================================================================
    // FINAL STEP: Delete user from auth.users using admin API
    // =========================================================================
    log(requestId, 'INFO', '🔐 Deleting user from auth.users...')
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      log(requestId, 'ERROR', `❌ Failed to delete user from auth: ${deleteError.message}`)
      throw new Error(`Failed to delete user account: ${deleteError.message}`)
    }

    log(requestId, 'SUCCESS', `✅ User ${userId} (${user.email}) completely deleted from auth.users`)
    log(requestId, 'SUCCESS', '🎉 Account deletion completed successfully')

    return new Response(JSON.stringify({
      success: true,
      message: 'Account deleted successfully',
      details: {
        price_history_deleted: priceHistoryCount ?? 0,
        invoices_deleted: invoicesCount ?? 0,
        supplier_whitelist_deleted: whitelistCount ?? 0,
        subscriptions_deleted: subCount ?? 0,
      },
      requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    log(requestId, 'ERROR', `💥 Error: ${error.message}`)
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      requestId
    }), {
      status: error.message.includes('Unauthorized') ? 401 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})