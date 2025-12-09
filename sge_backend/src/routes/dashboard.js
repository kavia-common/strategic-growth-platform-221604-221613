const express = require('express');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Dashboard analytics
 */

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Get dashboard summary metrics
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Summary metrics
 */
router.get('/summary', (req, res) => {
    // Mock aggregated analytics
    res.json({
        totalConversations: 12,
        activeUsers: 4,
        messagesCount: 145,
        growth: 15.5,
        recentActivity: [
            { date: '2023-10-25', count: 20 },
            { date: '2023-10-26', count: 35 },
            { date: '2023-10-27', count: 12 }
        ]
    });
});

module.exports = router;
