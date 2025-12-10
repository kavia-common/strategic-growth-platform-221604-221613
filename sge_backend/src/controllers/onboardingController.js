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

    // Validate input
    if (!organization_name || typeof organization_name !== 'string' || organization_name.trim() === '') {
      return res.status(400).json({ 
        error: 'organization_name is required and must be a non-empty string' 
      });
    }

    console.log(`Onboarding request for user ${userId}, org: ${organization_name}`);

    try {
      // Check if user is already onboarded (idempotency)
      const isOnboarded = await userOnboardingService.isUserOnboarded(userId);

      if (isOnboarded) {
        // User already has a profile - fetch and return existing data
        console.log(`User ${userId} is already onboarded, returning existing data`);
        
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id, org_id, role, full_name')
          .eq('id', userId)
          .single();

        if (profileError) {
          throw new Error(`Failed to fetch existing profile: ${profileError.message}`);
        }

        const { data: org, error: orgError } = await supabaseAdmin
          .from('organizations')
          .select('id, name')
          .eq('id', profile.org_id)
          .single();

        if (orgError) {
          throw new Error(`Failed to fetch existing organization: ${orgError.message}`);
        }

        return res.status(200).json({
          success: true,
          message: 'User already onboarded',
          org,
          profile
        });
      }

      // Perform onboarding
      const { organization, profile } = await userOnboardingService.onboardUser(userId, {
        organization_name
      });

      console.log(`Successfully onboarded user ${userId}`);

      return res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully',
        org: organization,
        profile
      });

    } catch (error) {
      console.error('Onboarding error:', error);
      return res.status(500).json({
        error: 'Failed to complete onboarding',
        details: error.message
      });
    }
  });
}

module.exports = new OnboardingController();
