'use strict';

const express    = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const { z }      = require('zod');
const chatService = require('../services/chat.service');
const { optionalAuth } = require('../middleware/auth.middleware');

const router = express.Router();

// ─── Dedicated chat rate limiter ──────────────────────────────────────────────
// Separate from auth limits: 20 requests per 15 minutes per IP.
// This protects the Gemini free-tier daily quota from being burned by one user.
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    meta: null,
    error: {
      code: 'CHAT_RATE_LIMITED',
      message: 'Too many messages. Please wait a few minutes before sending more.',
      fields: null,
    },
  },
  keyGenerator: ipKeyGenerator,
});

// ─── Request schema ───────────────────────────────────────────────────────────
const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role:    z.enum(['user', 'model']),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(20), // cap conversation history to 20 turns
});

// ─── POST /api/v1/chat ────────────────────────────────────────────────────────
// Public (optionalAuth) — accessible from public catalog and customer portal.
// Does NOT require a JWT so unauthenticated visitors can use the chatbot too.
router.post('/', chatLimiter, optionalAuth, async (req, res) => {
  // Validate request body
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      data: null,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid chat request.',
        fields: parsed.error.errors.map((e) => ({ field: e.path.join('.'), issue: e.message })),
      },
    });
  }

  try {
    const { messages } = parsed.data;
    const result = await chatService.chat(messages);

    return res.json({
      success: true,
      data: {
        reply:  result.reply,
        source: result.source, // 'gemini' | 'fallback'
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
        pagination: null,
      },
      error: null,
    });
  } catch (err) {
    console.error('[chat.routes] Unexpected error:', err.message);
    return res.status(500).json({
      success: false,
      data: null,
      meta: { requestId: req.requestId, timestamp: new Date().toISOString(), pagination: null },
      error: {
        code: 'CHAT_ERROR',
        message: 'Chat service temporarily unavailable.',
        fields: null,
      },
    });
  }
});

module.exports = router;
