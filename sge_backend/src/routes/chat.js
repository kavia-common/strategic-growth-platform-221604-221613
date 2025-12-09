const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Chat management and messaging
 */

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: List all conversations for the user
 *     tags: [Chat]
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/conversations', chatController.listConversations);

/**
 * @swagger
 * /api/chat/conversations:
 *   post:
 *     summary: Create a new conversation
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created conversation
 */
router.post('/conversations', chatController.createConversation);

/**
 * @swagger
 * /api/chat/conversations/{id}/messages:
 *   get:
 *     summary: Get messages for a conversation
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of messages
 */
router.get('/conversations/:id/messages', chatController.listMessages);

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Send a message to the chat
 *     tags: [Chat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               conversation_id:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Message sent and reply received
 */
router.post('/message', chatController.sendMessage);

module.exports = router;
