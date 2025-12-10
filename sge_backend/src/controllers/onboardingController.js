const asyncHandler = require('express-async-handler');
const userOnboardingService = require('../services/userOnboardingService');
const { supabaseAdmin } = require('../utils/supabase');

/**
 * Onboarding Controller
 * Handles user onboarding operations including organization and profile creation
 */
class OnboardingController {
  /**
   * PUBLIC_INTERFACE
   * Complete user onboarding after signup
   * POST /api/onboarding/complete
   * 
   * @param {object} req - Express request object
   * @param {object} req.body - Request body
   * @param {string} req.body.organization_name - Organization name to join or create
   * @param {object} req.user - Authenticated user from middleware
   * @returns {object} Response with organization and profile data
   * 
   * @swagger
   * /api/onboarding/complete:
   *   post:
   *     summary: Complete user onboarding
   *     description: |
   *       Authenticates the user via Supabase JWT from Authorization header,
   *       accepts organization_name in JSON body, finds or creates the organization
   *       (case-insensitive), and creates a profile with role='member' if it doesn't exist.
   *       This endpoint is idempotent - safe to call multiple times.
   *     tags:
   *       - Onboarding
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - organization_name
   *             properties:
   *               organization_name:
   *                 type: string
   *                 description: Name of the organization to join or create
   *                 example: "Acme Corporation"
   *     responses:
   *       200:
   *         description: Onboarding completed successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Onboarding completed successfully"
   *                 org:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     name:
   *                       type: string
   *                 profile:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     org_id:
   *                       type: string
   *                       format: uuid
   *                     role:
   *                       type: string
   *                       example: "member"
   *                     full_name:
   *                       type: string
   *                       nullable: true
   *       400:
   *         description: Bad request - missing organization_name
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 error:
   *                   type: string
   *                   example: "organization_name is required"
   *       401:
   *         description: Unauthorized - invalid or missing JWT token
   *       500:
   *         description: Internal server error
   */
  completeOnboarding = asyncHandler(async (req, res) => {
    const { organization_name } = req.body;
    const userId = req.user?.id;

    console.log('[OnboardingController] completeOnboarding called');
    console.log(`[OnboardingController] User ID: ${userId}`);
    console.log(`[OnboardingController] Organization name: ${organization_name}`);
    console.log('[OnboardingController] Request body:', req.body);
    console.log('[OnboardingController] User object:', req.user);

    // Validate input
    if (!organization_name || typeof organization_name !== 'string' || organization_name.trim() === '') {
      console.log('[OnboardingController] Validation failed: invalid organization_name');
      return res.status(400).json({ 
        error: 'organization_name is required and must be a non-empty string' 
      });
    }

    console.log('[OnboardingController] Validation passed, proceeding with onboarding');

    try {
      // Check if user is already onboarded (idempotency)
      console.log(`[OnboardingController] Checking if user ${userId} is already onboarded...`);
      const isOnboarded = await userOnboardingService.isUserOnboarded(userId);
      console.log(`[OnboardingController] Is user onboarded? ${isOnboarded}`);

      if (isOnboarded) {
        // User already has a profile - fetch and return existing data
        console.log(`[OnboardingController] User ${userId} is already onboarded, fetching existing data`);
        
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id, org_id, role, full_name')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('[OnboardingController] Error fetching existing profile:', profileError);
          throw new Error(`Failed to fetch existing profile: ${profileError.message}`);
        }

        console.log('[OnboardingController] Existing profile found:', profile);

        const { data: org, error: orgError } = await supabaseAdmin
          .from('organizations')
          .select('id, name')
          .eq('id', profile.org_id)
          .single();

        if (orgError) {
          console.error('[OnboardingController] Error fetching existing organization:', orgError);
          throw new Error(`Failed to fetch existing organization: ${orgError.message}`);
        }

        console.log('[OnboardingController] Existing organization found:', org);
        console.log('[OnboardingController] Returning existing data to client');

        return res.status(200).json({
          success: true,
          message: 'User already onboarded',
          org,
          profile
        });
      }

      // Perform onboarding
      console.log('[OnboardingController] User not yet onboarded, starting onboarding process...');
      const { organization, profile } = await userOnboardingService.onboardUser(userId, {
        organization_name
      });

      console.log('[OnboardingController] Onboarding completed successfully');
      console.log('[OnboardingController] Organization:', organization);
      console.log('[OnboardingController] Profile:', profile);

      console.log('[OnboardingController] Sending success response to client');
      return res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully',
        org: organization,
        profile
      });

    } catch (error) {
      console.error('[OnboardingController] Onboarding error:', error);
      console.error('[OnboardingController] Error stack:', error.stack);
      return res.status(500).json({
        error: 'Failed to complete onboarding',
        details: error.message
      });
    }
  });
}

module.exports = new OnboardingController();
