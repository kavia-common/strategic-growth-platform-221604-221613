const { supabase, getAuthenticatedSupabase } = require('../utils/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Validate token
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Pass the token for downstream usage
    req.token = token;

    // Fetch profile to get org_id
    // Use authenticated client to respect RLS
    const authClient = getAuthenticatedSupabase(token);
    const { data: profile, error: profileError } = await authClient
      .from('profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
        // Log error but don't fail if just not found (might be new user)
        console.warn('Profile fetch failed', profileError);
    }

    req.user = {
      id: user.id,
      email: user.email,
      org_id: profile?.org_id,
      role: profile?.role
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error during authentication' });
  }
};

module.exports = authMiddleware;
