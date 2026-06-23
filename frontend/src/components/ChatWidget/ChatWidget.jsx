import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import apiClient from '../../services/apiClient.js';
import './ChatWidget.css';

// ─── Starter suggestion chips ─────────────────────────────────────────────────
const STARTER_CHIPS = [
  'How does booking work?',
  'What is the deposit policy?',
  'Is any equipment available?',
  'How do I cancel a booking?',
];

// ─── Markdown-lite renderer ───────────────────────────────────────────────────
// Converts **bold**, [links](/path) and \n into HTML safely.
function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_self" rel="noopener" style="color:var(--blue);text-decoration:underline">$1</a>')
    .replace(/\n/g, '<br>');
}

// ─── Single message bubble ────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--ai'}`}
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {!isUser && msg.source === 'fallback' && (
        <div className="chat-bubble__offline-tag">
          <AlertCircle size={10} /> Offline mode
        </div>
      )}
      {isUser ? (
        <span>{msg.content}</span>
      ) : (
        <span
          className="chat-bubble__ai-text"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
      )}
    </motion.div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="chat-bubble chat-bubble--ai chat-typing">
      <span className="chat-typing__dot" />
      <span className="chat-typing__dot" />
      <span className="chat-typing__dot" />
    </div>
  );
}

// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function ChatWidget() {
  const [isOpen, setIsOpen]     = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'model',
      content: 'Hi! I\'m the SD Digitals assistant. I can help with booking, equipment, policies, and account questions.\n\nWhat can I help you with today?',
      source: 'gemini',
    },
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
      setHasUnread(false);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      // Only send last 10 turns to the backend to keep payload small
      const historyToSend = newMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await apiClient.sendChatMessage(historyToSend);
      const { reply, source } = res.data;

      setMessages((prev) => [
        ...prev,
        { role: 'model', content: reply, source },
      ]);

      if (!isOpen) setHasUnread(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          content: 'I\'m having trouble connecting right now. For immediate assistance, contact **ops@sddigitals.in** or call **+91 11 4059 8899**.',
          source: 'fallback',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* ── Floating Toggle Button ───────────────────────────────────────── */}
      <motion.button
        id="chat-widget-toggle"
        className={`chat-fab ${isOpen ? 'chat-fab--open' : ''}`}
        onClick={() => setIsOpen((p) => !p)}
        aria-label={isOpen ? 'Close chat' : 'Open SD Digitals assistant'}
        aria-expanded={isOpen}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <X size={22} />
            </motion.span>
          ) : (
            <motion.span key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <MessageSquare size={22} />
            </motion.span>
          )}
        </AnimatePresence>
        {hasUnread && !isOpen && <span className="chat-fab__badge" aria-hidden="true" />}
      </motion.button>

      {/* ── Chat Panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="chat-widget-panel"
            className="chat-panel"
            role="dialog"
            aria-label="SD Digitals customer support chat"
            aria-modal="false"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="chat-panel__header">
              <div className="chat-panel__header-left">
                <div className="chat-panel__avatar">
                  <Sparkles size={14} />
                </div>
                <div>
                  <div className="chat-panel__title">SD Digitals Assistant</div>
                  <div className="chat-panel__subtitle">
                    <span className="chat-panel__status-dot" aria-hidden="true" />
                    {loading ? 'Typing…' : 'Online'}
                  </div>
                </div>
              </div>
              <button
                className="chat-panel__close"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className="chat-panel__messages" aria-live="polite" aria-label="Chat messages">
              {messages.map((msg, i) => (
                <ChatBubble key={i} msg={msg} />
              ))}
              {loading && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* Starter chips (only before first user message) */}
            {messages.length === 1 && !loading && (
              <div className="chat-starter-chips" role="group" aria-label="Quick questions">
                {STARTER_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    className="chat-chip"
                    onClick={() => sendMessage(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Input area */}
            <div className="chat-panel__input-area">
              <textarea
                ref={inputRef}
                id="chat-input"
                className="chat-panel__input"
                placeholder="Ask about bookings, equipment, policies…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                aria-label="Chat message input"
                disabled={loading}
                maxLength={500}
              />
              <button
                id="chat-send-btn"
                className="chat-panel__send"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                aria-label="Send message"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

            {/* Footer */}
            <div className="chat-panel__footer">
              <Sparkles size={10} />
              Powered by Gemini · SD Digitals
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
