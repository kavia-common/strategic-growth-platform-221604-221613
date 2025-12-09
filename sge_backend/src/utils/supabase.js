const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Please check your .env file.');
  console.warn('Supabase features will be unavailable.');
}

// Default client (anon) - only create if credentials are available
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// Admin client (service role) - for bypassing RLS if needed
const supabaseAdmin = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

// Helper to get client context for a specific user token
const getAuthenticatedSupabase = (token) => {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase is not configured. Cannot create authenticated client.');
  }
  return createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

module.exports = {
  supabase,
  supabaseAdmin,
  getAuthenticatedSupabase
};
