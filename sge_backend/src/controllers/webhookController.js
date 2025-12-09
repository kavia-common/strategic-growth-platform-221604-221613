const asyncHandler = require('express-async-handler');
const userOnboardingService = require('../services/userOnboardingService');

/**
 * PUBLIC_INTERFACE
 * Handle Supabase Auth webhooks
 * This endpoint receives webhook events from Supabase Auth
 * to trigger user onboarding when a new user signs up.
 * 
 * Webhook should be configured in Supabase Dashboard:
 * Authentication -> Webhooks -> Add Webhook
 * Event: user.created
 * URL: https://your-backend-url/webhooks/auth
 */
const handleAuthWebhook = asyncHandler(async (req, res) => {
  try {
    const { type, record } = req.body;

    console.log('Received auth webhook:', { type, userId: record?.id });

    // Only handle user.created events
    if (type !== 'INSERT' && type !== 'user.created') {
      return res.status(200).json({ 
        message: 'Event type not handled',
        type 
      });
    }

    // Extract user information
    const userId = record?.id;
    const userMetadata = record?.raw_user_meta_data || record?.user_metadata || {};

    if (!userId) {
      console.error('No user ID in webhook payload');
      return res.status(400).json({ error: 'Invalid webhook payload: missing user ID' });
    }

    // Check if user is already onboarded
    const isOnboarded = await userOnboardingService.isUserOnboarded(userId);
    if (isOnboarded) {
      console.log(`User ${userId} is already onboarded, skipping`);
      return res.status(200).json({ 
        message: 'User already onboarded',
        userId 
      });
    }

    // Perform onboarding
    const result = await userOnboardingService.onboardUser(userId, userMetadata);

    res.status(200).json({
      success: true,
      message: 'User onboarded successfully',
      userId,
      organizationId: result.organization.id,
      organizationName: result.organization.name
    });
  } catch (error) {
    console.error('Auth webhook error:', error);
    
    // Return 200 to prevent Supabase from retrying
    // But log the error for debugging
    res.status(200).json({
      success: false,
      error: error.message,
      message: 'Webhook processed with errors'
    });
  }
});

/**
 * PUBLIC_INTERFACE
 * Manual onboarding endpoint for testing or fixing missing profiles
 * This can be called manually to onboard a user if the webhook failed
 */
const manualOnboard = asyncHandler(async (req, res) => {
  const { userId, organizationName } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  // Check if user is already onboarded
  const isOnboarded = await userOnboardingService.isUserOnboarded(userId);
  if (isOnboarded) {
    return res.status(400).json({ 
      error: 'User is already onboarded',
      userId 
    });
  }

  const result = await userOnboardingService.onboardUser(userId, {
    organization_name: organizationName
  });

  res.status(200).json({
    success: true,
    message: 'User onboarded successfully',
    organization: result.organization,
    profile: result.profile
  });
});

module.exports = {
  handleAuthWebhook,
  manualOnboard
};
