'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { publicBotService, type PublicBotConfig } from '@/services/PublicBotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';
import SkillCardRenderer from './SkillCardRenderer';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  responseType?: string;
  skillCard?: any;
  skillName?: string | null;
  feedback?: 'positive' | 'negative' | null;
}

interface PublicBotWidgetProps {
  tenantId: string;
  pageContext?: 'storefront' | 'product' | 'directory';
  hasActivePaymentGateway?: boolean;
}

const POSITION_CLASSES: Record<string, string> = {
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
};

const PANEL_POSITION_CLASSES: Record<string, string> = {
  'bottom-right': 'bottom-20 right-4',
  'bottom-left': 'bottom-20 left-4',
  'top-right': 'top-20 right-4',
  'top-left': 'top-20 left-4',
};

export default function PublicBotWidget({
  tenantId,
  pageContext = 'storefront',
  hasActivePaymentGateway = false,
}: PublicBotWidgetProps) {
  const { data: chatbotCaps } = useChatbotOptionsCapability(tenantId);
  const [config, setConfig] = useState<PublicBotConfig | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preChatDone, setPreChatDone] = useState(false);
  const [preChatEmail, setPreChatEmail] = useState('');
  const [preChatPhone, setPreChatPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [autoOpenTriggered, setAutoOpenTriggered] = useState(false);
  const [platformLogoUrl, setPlatformLogoUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch platform settings for default logo
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await platformSettingsService.getPlatformSettings();
        if (!cancelled && settings?.logoUrl) {
          setPlatformLogoUrl(settings.logoUrl);
        }
      } catch {
        // Non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch widget config when capability is confirmed
  useEffect(() => {
    if (!tenantId || !chatbotCaps?.enabled || !chatbotCaps?.widgetEnabled) return;
    let cancelled = false;
    (async () => {
      const cfg = await publicBotService.getWidgetConfig(tenantId);
      if (!cancelled && cfg && cfg.status === 'active') {
        setConfig(cfg);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId, chatbotCaps?.enabled, chatbotCaps?.widgetEnabled]);

  // Auto-open after delay if configured
  useEffect(() => {
    if (!config || autoOpenTriggered || isOpen) return;
    // Auto-open after 5 seconds as a default; could be made configurable
    const timer = setTimeout(() => {
      setIsOpen(true);
      setAutoOpenTriggered(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [config, autoOpenTriggered, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && preChatDone && inputRef.current) {
      inputRef.current?.focus();
    }
  }, [isOpen, preChatDone]);

  const startConversation = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await publicBotService.startConversation({
        tenantId,
        customerEmail: preChatEmail || undefined,
        customerPhone: preChatPhone || undefined,
        pageContext,
      });
      setSessionId(result.sessionId);
      setMessages([{
        id: 'greeting',
        role: 'assistant',
        content: result.greeting,
        responseType: 'greeting',
      }]);
      setPreChatDone(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to start conversation');
    } finally {
      setLoading(false);
    }
  }, [tenantId, preChatEmail, preChatPhone, pageContext]);

  const sendMessage = useCallback(async () => {
    if (!sessionId || !inputValue.trim()) return;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
    };
    setMessages(prev => [...prev, userMsg]);
    const msgText = inputValue.trim();
    setInputValue('');
    setLoading(true);
    setError(null);
    try {
      const result = await publicBotService.sendMessage(sessionId, msgText);
      setMessages(prev => [...prev, {
        id: result.messageId,
        role: 'assistant',
        content: result.reply,
        responseType: result.responseType,
        skillCard: result.skillCard,
        skillName: result.skillName,
        feedback: null,
      }]);
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I had trouble responding. Please try again.',
        responseType: 'error',
      }]);
    } finally {
      setLoading(false);
    }
  }, [sessionId, inputValue]);

  const handleFeedback = useCallback(async (messageId: string, rating: 'positive' | 'negative') => {
    if (!sessionId || messageId === 'greeting') return;
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, feedback: rating } : m
    ));
    try {
      await publicBotService.submitFeedback(sessionId, messageId, rating);
    } catch {
      // Non-critical
    }
  }, [sessionId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Gate 1: Capability check (tier + capability)
  if (!chatbotCaps?.enabled || !chatbotCaps?.widgetEnabled) return null;

  // Gate 2: Config loaded and bot is active
  if (!config) return null;

  const position = config.widgetPosition || 'bottom-right';
  const posClass = POSITION_CLASSES[position] || POSITION_CLASSES['bottom-right'];
  const panelPosClass = PANEL_POSITION_CLASSES[position] || PANEL_POSITION_CLASSES['bottom-right'];
  const accentColor = config.widgetColor || '#4F46E5';
  const botName = config.botName || 'Assistant';
  const avatarUrl = config.widgetAvatarUrl || platformLogoUrl;
  const needsPreChat = config.preChatEnabled && !preChatDone && !sessionId;

  return (
    <>
      {/* Chat Panel */}
      {isOpen && (
        <div
          className={`fixed ${panelPosClass} z-[9999] w-[calc(100vw-2rem)] sm:w-96 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden`}
          style={{ maxHeight: '70vh', height: '70vh' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white shrink-0"
            style={{ background: accentColor }}
          >
            <div className="flex items-center gap-2 min-w-0">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={botName}
                  className="w-8 h-8 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg shrink-0">
                  💬
                </div>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">{botName}</div>
                <div className="text-xs text-white/80 truncate">
                  {loading ? 'Typing...' : 'Online'}
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors shrink-0"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-neutral-50 dark:bg-neutral-800">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'text-white rounded-br-sm'
                      : 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-bl-sm shadow-sm'
                  }`}
                  style={msg.role === 'user' ? { background: accentColor } : undefined}
                >
                  <p className="whitespace-pre-line">{msg.content}</p>

                  {/* Skill Card */}
                  {msg.skillCard && (
                    <SkillCardRenderer card={msg.skillCard} />
                  )}

                  {/* Feedback buttons for assistant messages */}
                  {msg.role === 'assistant' && msg.responseType !== 'greeting' && msg.responseType !== 'error' && (
                    <div className="flex items-center gap-1 mt-1.5">
                      <button
                        onClick={() => handleFeedback(msg.id, 'positive')}
                        className={`p-1 rounded transition-colors ${
                          msg.feedback === 'positive'
                            ? 'text-green-500'
                            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                        }`}
                        aria-label="Helpful"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20a2 2 0 002 2v0a2 2 0 002-2v0M9 14h4" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleFeedback(msg.id, 'negative')}
                        className={`p-1 rounded transition-colors ${
                          msg.feedback === 'negative'
                            ? 'text-red-500'
                            : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
                        }`}
                        aria-label="Not helpful"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14h-4.764a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.737 3h4.017c.163 0 .326.02.485.06L17 4m-7 10v5a2 2 0 002 2v0a2 2 0 002-2v0m-4-10h2m4 0a2 2 0 100-4m-4 0a2 2 0 110 4" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-neutral-700 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-center text-xs text-red-500">{error}</div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Pre-chat Form (overlay at bottom of panel) */}
          {needsPreChat && !loading && (
            <div className="absolute inset-0 top-[52px] bg-white dark:bg-neutral-900 flex flex-col items-center justify-center p-6 gap-3">
              <div className="text-3xl mb-1">💬</div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-white text-center">
                Chat with {botName}
              </h3>
              {config.greeting && (
                <p className="text-sm text-neutral-500 text-center max-w-xs">{config.greeting}</p>
              )}
              {config.preChatEmail && (
                <input
                  type="email"
                  value={preChatEmail}
                  onChange={(e) => setPreChatEmail(e.target.value)}
                  placeholder="Your email (optional)"
                  className="w-full max-w-xs px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              )}
              {config.preChatPhone && (
                <input
                  type="tel"
                  value={preChatPhone}
                  onChange={(e) => setPreChatPhone(e.target.value)}
                  placeholder="Your phone (optional)"
                  className="w-full max-w-xs px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                />
              )}
              <button
                onClick={startConversation}
                className="w-full max-w-xs px-4 py-2.5 rounded-lg text-white font-medium text-sm transition-colors hover:opacity-90"
                style={{ background: accentColor }}
              >
                Start Chat
              </button>
            </div>
          )}

          {/* Input Area */}
          {!needsPreChat && (
            <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-700 p-3 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={loading || !sessionId}
                  className="flex-1 px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-600 rounded-lg bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || !sessionId || !inputValue.trim()}
                  className="p-2 rounded-lg text-white transition-colors hover:opacity-90 disabled:opacity-50 shrink-0"
                  style={{ background: accentColor }}
                  aria-label="Send message"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              {/* After-hours message */}
              {config.afterHoursEnabled && config.afterHoursMessage && (
                <p className="text-xs text-neutral-400 mt-1.5 text-center">{config.afterHoursMessage}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setAutoOpenTriggered(true);
            if (!needsPreChat && !sessionId) {
              startConversation();
            }
          }}
          className={`fixed ${posClass} z-[9998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95`}
          style={{ background: accentColor }}
          aria-label={`Open chat with ${botName}`}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={botName}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
        </button>
      )}
    </>
  );
}
