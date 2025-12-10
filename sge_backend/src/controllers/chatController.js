const asyncHandler = require('express-async-handler');
const { getAuthenticatedSupabase } = require('../utils/supabase');
const geminiService = require('../services/geminiService');

const createConversation = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedSupabase(req.token);
  const { title } = req.body;
  
  if (!req.user.org_id) {
    return res.status(400).json({ error: 'User does not belong to an organization' });
  }

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      user_id: req.user.id,
      org_id: req.user.org_id,
      title: title || 'New Conversation'
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  res.status(201).json(data);
});

const listConversations = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedSupabase(req.token);
  
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  res.json(data);
});

const listMessages = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedSupabase(req.token);
  const { id } = req.params;

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  res.json(data);
});

const sendMessage = asyncHandler(async (req, res) => {
  const supabase = getAuthenticatedSupabase(req.token);
  const { conversation_id, content } = req.body;
  
  if (!req.user.org_id) {
    return res.status(400).json({ error: 'User does not belong to an organization' });
  }

  let chatId = conversation_id;

  // 1. If no conversation_id, create new conversation
  if (!chatId) {
    const title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .insert({
        user_id: req.user.id,
        org_id: req.user.org_id,
        title
      })
      .select()
      .single();
    
    if (convError) throw new Error(convError.message);
    chatId = conv.id;
  }

  // 2. Store user message
  const { data: userMsg, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: chatId,
      org_id: req.user.org_id,
      user_id: req.user.id,
      role: 'user',
      content
    })
    .select()
    .single();

  if (msgError) throw new Error(msgError.message);

  // 3. Fetch history for context (exclude current message)
  // We fetch last 21 messages to get 20 previous ones + the current one
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', chatId)
    .order('created_at', { ascending: true });
    
  // Filter out the message we just added based on content or assume it's the last one
  // Simple approach: exclude the very last one if it matches our insertion
  const previousHistory = history.filter(msg => 
      // This is a naive check; ideally use ID but we didn't select ID in history query
      // Re-fetching or just taking all except last
      msg.content !== userMsg.content || msg.role !== userMsg.role
  ); 
  // Better: just slice. If we just inserted, it's at the end.
  const contextHistory = history.slice(0, -1);

  // 4. Generate reply
  let replyContent = '';
  try {
    replyContent = await geminiService.generateReply(content, contextHistory);
  } catch (err) {
    console.error('Gemini error:', err);
    // Fallback to echo behavior as per requirements if AI service is unavailable
    replyContent = `I got this input: ${content}`;
  }

  // 5. Store assistant message
  const { data: assistantMsg, error: replyError } = await supabase
    .from('messages')
    .insert({
      conversation_id: chatId,
      org_id: req.user.org_id,
      role: 'assistant',
      content: replyContent
    })
    .select()
    .single();

  if (replyError) throw new Error(replyError.message);

  res.json({
    conversation_id: chatId,
    userMessage: userMsg,
    assistantMessage: assistantMsg
  });
});

module.exports = {
  createConversation,
  listConversations,
  listMessages,
  sendMessage
};
