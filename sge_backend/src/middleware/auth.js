const { supabase, getAuthenticatedSupabase } = require('../utils/supabase');

const authMiddleware = async (req, res, next) => {
  console.log('[AuthMiddleware] Processing authentication...');
  console.log(`[AuthMiddleware] Path: ${req.path}, Method: ${req.method}`);
  
  try {
    const authHeader = req.headers.authorization;
    console.log(`[AuthMiddleware] Auth header present: ${!!authHeader}`);
    
    if (!authHeader) {
      console.log('[AuthMiddleware] No authorization header provided');
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log(`[AuthMiddleware] Token extracted, length: ${token.length}`);
    
    // Validate token
    console.log('[AuthMiddleware] Validating token with Supabase...');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    console.log('[AuthMiddleware] Token validation result:', { user: user ? { id: user.id, email: user.email } : null, error });

    if (error || !user) {
      console.log('[AuthMiddleware] Token validation failed:', error?.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log(`[AuthMiddleware] Token valid for user: ${user.id} (${user.email})`);

    // Pass the token for downstream usage
    req.token = token;

    // Fetch profile to get org_id
    // Use authenticated client to respect RLS
    console.log('[AuthMiddleware] Fetching user profile...');
    const authClient = getAuthenticatedSupabase(token);
    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    console.log('[AuthMiddleware] Profile fetch result:', { profile, profileError });

    if (profileError && profileError.code !== 'PGRST116') {
        // Log error but don't fail if just not found (might be new user)
        console.warn('[AuthMiddleware] Profile fetch failed (non-critical for new users):', profileError);
    }

    req.user = {
      id: user.id,
      email: user.email,
      org_id: profile?.org_id,
      role: profile?.role
    };

    console.log('[AuthMiddleware] User object set on request:', req.user);
    console.log('[AuthMiddleware] Authentication successful, proceeding to next middleware');
    next();
  } catch (err) {
    console.error('[AuthMiddleware] Unexpected error:', err);
    console.error('[AuthMiddleware] Error stack:', err.stack);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = authMiddleware;
