const express = require('express');
const onboardingController = require('../controllers/onboardingController');

const router = express.Router();

/**
 * POST /api/onboarding/complete
 * Complete user onboarding by creating organization and profile
 * Requires authentication via JWT token
 */
router.post('/complete', onboardingController.completeOnboarding);

module.exports = router;
