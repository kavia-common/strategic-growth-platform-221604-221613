const { supabaseAdmin } = require('../utils/supabase');

/**
 * Service for handling user onboarding operations
 * This service manages organization and profile creation during user signup
 */
class UserOnboardingService {
  /**
   * Find or create an organization by name
   * @param {string} orgName - The organization name
   * @returns {Promise<{id: string, name: string}>} The organization record
   */
  async findOrCreateOrganization(orgName) {
    console.log('[UserOnboardingService] findOrCreateOrganization called');
    console.log(`[UserOnboardingService] Input orgName: "${orgName}"`);
    
    if (!supabaseAdmin) {
      console.error('[UserOnboardingService] Supabase admin client is not configured!');
      throw new Error('Supabase admin client is not configured');
    }

    console.log('[UserOnboardingService] Supabase admin client is available');

    // Normalize the organization name
    const normalizedName = orgName?.trim() || 'Default Organization';
    console.log(`[UserOnboardingService] Normalized name: "${normalizedName}"`);

    // First, try to find existing organization with this name
    console.log('[UserOnboardingService] Searching for existing organization...');
    const { data: existingOrg, error: searchError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .ilike('name', normalizedName)
      .limit(1)
      .single();

    console.log('[UserOnboardingService] Search result:', { existingOrg, searchError });

    if (existingOrg) {
      console.log(`[UserOnboardingService] Found existing organization: ${existingOrg.name} (${existingOrg.id})`);
      return existingOrg;
    }

    // If not found and error is not "no rows", throw the error
    if (searchError && searchError.code !== 'PGRST116') {
      console.error('[UserOnboardingService] Error searching for organization:', searchError);
      console.error('[UserOnboardingService] Error code:', searchError.code);
      console.error('[UserOnboardingService] Error details:', searchError.details);
      throw new Error(`Failed to search for organization: ${searchError.message}`);
    }

    // Create new organization
    console.log(`[UserOnboardingService] No existing org found, creating new organization: ${normalizedName}`);
    const { data: newOrg, error: createError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: normalizedName })
      .select('id, name')
      .single();

    console.log('[UserOnboardingService] Create result:', { newOrg, createError });

    if (createError) {
      console.error('[UserOnboardingService] Error creating organization:', createError);
      console.error('[UserOnboardingService] Error code:', createError.code);
      console.error('[UserOnboardingService] Error details:', createError.details);
      console.error('[UserOnboardingService] Error hint:', createError.hint);
      throw new Error(`Failed to create organization: ${createError.message}`);
    }

    console.log(`[UserOnboardingService] Successfully created organization: ${newOrg.name} (${newOrg.id})`);
    return newOrg;
  }

  /**
   * Create a profile for a user
   * @param {string} userId - The user's auth.users id
   * @param {string} orgId - The organization id
   * @param {string|null} fullName - Optional full name
   * @returns {Promise<object>} The created profile
   */
  async createProfile(userId, orgId, fullName = null) {
    console.log('[UserOnboardingService] createProfile called');
    console.log(`[UserOnboardingService] userId: ${userId}, orgId: ${orgId}, fullName: ${fullName}`);
    
    if (!supabaseAdmin) {
      console.error('[UserOnboardingService] Supabase admin client is not configured!');
      throw new Error('Supabase admin client is not configured');
    }

    const profileData = {
      id: userId,
      org_id: orgId,
      role: 'member',
      full_name: fullName
    };

    console.log('[UserOnboardingService] Inserting profile with data:', profileData);
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert(profileData)
      .select()
      .single();

    console.log('[UserOnboardingService] Profile insert result:', { profile, profileError });

    if (profileError) {
      console.error('[UserOnboardingService] Error creating profile:', profileError);
      console.error('[UserOnboardingService] Error code:', profileError.code);
      console.error('[UserOnboardingService] Error details:', profileError.details);
      console.error('[UserOnboardingService] Error hint:', profileError.hint);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log(`[UserOnboardingService] Successfully created profile for user ${userId}`);
    return profile;
  }

  /**
   * PUBLIC_INTERFACE
   * Handle complete user onboarding flow
   * @param {string} userId - The user's auth.users id
   * @param {object} metadata - User metadata containing organization_name
   * @returns {Promise<{organization: object, profile: object}>} The created records
   */
  async onboardUser(userId, metadata = {}) {
    console.log('[UserOnboardingService] onboardUser called');
    console.log(`[UserOnboardingService] userId: ${userId}`);
    console.log('[UserOnboardingService] metadata:', metadata);
    
    try {
      // Extract organization name from metadata
      const orgName = metadata.organization_name || metadata.organizationName;
      console.log(`[UserOnboardingService] Extracted orgName: "${orgName}"`);

      // Step 1: Find or create organization
      console.log('[UserOnboardingService] Step 1: Finding or creating organization...');
      const organization = await this.findOrCreateOrganization(orgName);
      console.log('[UserOnboardingService] Organization result:', organization);

      // Step 2: Create profile
      console.log('[UserOnboardingService] Step 2: Creating profile...');
      const profile = await this.createProfile(userId, organization.id, metadata.full_name || null);
      console.log('[UserOnboardingService] Profile result:', profile);

      console.log(`[UserOnboardingService] Successfully onboarded user ${userId}`);
      return { organization, profile };
    } catch (error) {
      console.error(`[UserOnboardingService] Failed to onboard user ${userId}:`, error);
      console.error('[UserOnboardingService] Error stack:', error.stack);
      throw error;
    }
  }

  /**
   * PUBLIC_INTERFACE
   * Check if a user has been onboarded (has a profile)
   * @param {string} userId - The user's auth.users id
   * @returns {Promise<boolean>} True if user has a profile
   */
  async isUserOnboarded(userId) {
    console.log('[UserOnboardingService] isUserOnboarded called');
    console.log(`[UserOnboardingService] Checking userId: ${userId}`);
    
    if (!supabaseAdmin) {
      console.error('[UserOnboardingService] Supabase admin client is not configured!');
      throw new Error('Supabase admin client is not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    console.log('[UserOnboardingService] isUserOnboarded query result:', { data, error });

    if (error && error.code !== 'PGRST116') {
      console.error('[UserOnboardingService] Error checking user onboarding status:', error);
      return false;
    }

    const isOnboarded = !!data;
    console.log(`[UserOnboardingService] User ${userId} is ${isOnboarded ? 'already' : 'not'} onboarded`);
    return isOnboarded;
  }
}

module.exports = new UserOnboardingService();
