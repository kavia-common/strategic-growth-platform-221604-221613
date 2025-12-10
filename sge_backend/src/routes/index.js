const express = require('express');
const healthController = require('../controllers/health');
const authMiddleware = require('../middleware/auth');
const chatRoutes = require('./chat');
const dashboardRoutes = require('./dashboard');
const webhookRoutes = require('./webhooks');
const onboardingRoutes = require('./onboarding');

const router = express.Router();
// Health endpoint

/**
 * @swagger
 * /:
 *   get:
 *     summary: Health endpoint
 *     responses:
 *       200:
 *         description: Service health check passed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 message:
 *                   type: string
 *                   example: Service is healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/', healthController.check.bind(healthController));

// Mount webhook routes (no auth required for Supabase webhooks)
router.use('/webhooks', webhookRoutes);

// Mount protected API routes
router.use('/api/chat', authMiddleware, chatRoutes);
router.use('/api/dashboard', authMiddleware, dashboardRoutes);
router.use('/api/onboarding', authMiddleware, onboardingRoutes);

module.exports = router;
