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
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured');
    }

    // Normalize the organization name
    const normalizedName = orgName?.trim() || 'Default Organization';

    // First, try to find existing organization with this name
    const { data: existingOrg, error: searchError } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .ilike('name', normalizedName)
      .limit(1)
      .single();

    if (existingOrg) {
      console.log(`Found existing organization: ${existingOrg.name} (${existingOrg.id})`);
      return existingOrg;
    }

    // If not found and error is not "no rows", throw the error
    if (searchError && searchError.code !== 'PGRST116') {
      console.error('Error searching for organization:', searchError);
      throw new Error(`Failed to search for organization: ${searchError.message}`);
    }

    // Create new organization
    console.log(`Creating new organization: ${normalizedName}`);
    const { data: newOrg, error: createError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: normalizedName })
      .select('id, name')
      .single();

    if (createError) {
      console.error('Error creating organization:', createError);
      throw new Error(`Failed to create organization: ${createError.message}`);
    }

    console.log(`Created organization: ${newOrg.name} (${newOrg.id})`);
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
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured');
    }

    console.log(`Creating profile for user ${userId} in org ${orgId}`);
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: userId,
        org_id: orgId,
        role: 'member',
        full_name: fullName
      })
      .select()
      .single();

    if (profileError) {
      console.error('Error creating profile:', profileError);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    console.log(`Created profile for user ${userId}`);
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
    try {
      console.log(`Starting onboarding for user ${userId}`, { metadata });

      // Extract organization name from metadata
      const orgName = metadata.organization_name || metadata.organizationName;

      // Step 1: Find or create organization
      const organization = await this.findOrCreateOrganization(orgName);

      // Step 2: Create profile
      const profile = await this.createProfile(userId, organization.id, metadata.full_name || null);

      console.log(`Successfully onboarded user ${userId}`);
      return { organization, profile };
    } catch (error) {
      console.error(`Failed to onboard user ${userId}:`, error);
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
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client is not configured');
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking user onboarding status:', error);
      return false;
    }

    return !!data;
  }
}

module.exports = new UserOnboardingService();
