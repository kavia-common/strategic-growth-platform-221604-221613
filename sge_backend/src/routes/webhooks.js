const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const authMiddleware = require('../middleware/auth');

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Webhook endpoints for external services
 */

/**
 * @swagger
 * /webhooks/auth:
 *   post:
 *     summary: Supabase Auth webhook endpoint
 *     description: Receives webhook events from Supabase Auth (e.g., user.created) to trigger automatic user onboarding including organization and profile creation.
 *     tags: [Webhooks]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 description: Event type (e.g., INSERT, user.created)
 *               record:
 *                 type: object
 *                 description: User record from Supabase
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: User UUID
 *                   email:
 *                     type: string
 *                   raw_user_meta_data:
 *                     type: object
 *                     description: User metadata including organization_name
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 userId:
 *                   type: string
 *                 organizationId:
 *                   type: string
 *                 organizationName:
 *                   type: string
 */
router.post('/auth', webhookController.handleAuthWebhook);

/**
 * @swagger
 * /webhooks/onboard:
 *   post:
 *     summary: Manual user onboarding endpoint
 *     description: Manually trigger user onboarding for users who were not automatically onboarded. Requires authentication.
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: User UUID to onboard
 *               organizationName:
 *                 type: string
 *                 description: Organization name (optional)
 *     responses:
 *       200:
 *         description: User onboarded successfully
 *       400:
 *         description: Invalid request or user already onboarded
 */
router.post('/onboard', authMiddleware, webhookController.manualOnboard);

module.exports = router;
