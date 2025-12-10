const asyncHandler = require('express-async-handler');
const { getAuthenticatedSupabase } = require('../utils/supabase');

// In-memory storage for "minimal no-AI chat flow"
// Note: These will be reset on server restart
const conversations = [];
const messages = [];

// Helper to generate simple IDs
const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const createConversation = asyncHandler(async (req, res) => {
  // We still use req.user from auth middleware
  const { title } = req.body;
  
  const newConv = {
    id: generateId('conv'),
    user_id: req.user.id,
    title: title || 'New Conversation',
    created_at: new Date().toISOString()
  };

  conversations.push(newConv);
  res.status(201).json(newConv);
});

const listConversations = asyncHandler(async (req, res) => {
  // Return in-memory conversations for the authenticated user
  const userConvs = conversations.filter(c => c.user_id === req.user.id);
  // Sort by created_at desc
  userConvs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  
  res.json(userConvs);
});

const listMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  // Return in-memory messages for the conversation
  const chatMessages = messages.filter(m => m.conversation_id === id);
  // Sort by created_at asc
  chatMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  res.json(chatMessages);
});

const sendMessage = asyncHandler(async (req, res) => {
  const { conversation_id, content } = req.body;
  
  let chatId = conversation_id;
  let conversationTitle = null;

  // 1. If no conversation_id, create new conversation
  if (!chatId) {
    chatId = generateId('conv');
    const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
    conversationTitle = title;
    
    const newConv = {
      id: chatId,
      user_id: req.user.id,
      title,
      created_at: new Date().toISOString()
    };
    conversations.push(newConv);
  }

  // 2. Store user message
  const userMsg = {
    id: generateId('msg-user'),
    conversation_id: chatId,
    user_id: req.user.id,
    role: 'user',
    content,
    created_at: new Date().toISOString()
  };
  messages.push(userMsg);

  // 3. Generate reply (Echo)
  const assistantContent = `I got this input: ${content}`;

  // 4. Store assistant message
  const assistantMsg = {
    id: generateId('msg-asst'),
    conversation_id: chatId,
    role: 'assistant',
    content: assistantContent,
    created_at: new Date(Date.now() + 50).toISOString() // slightly later
  };
  messages.push(assistantMsg);

  // Return specific shape required by task
  res.json({
    conversation_id: chatId,
    user_message: userMsg,
    assistant_message: assistantMsg
  });
});

module.exports = {
  createConversation,
  listConversations,
  listMessages,
  sendMessage
};
