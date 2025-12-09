const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase URL or Key is missing. Please check your .env file.');
}

// Default client (anon)
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client (service role) - for bypassing RLS if needed
const supabaseAdmin = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey) 
  : null;

// Helper to get client context for a specific user token
const getAuthenticatedSupabase = (token) => {
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
