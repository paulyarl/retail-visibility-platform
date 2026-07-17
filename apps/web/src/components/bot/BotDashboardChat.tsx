'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { botService } from '@/services/BotService';
import { useChatbotOptionsCapability } from '@/hooks/tenant-access/useCapabilityAccess';
import { MessageSquare, Send, Sparkles, X, Loader2 } from 'lucide-react';
import SkillCardRenderer from './SkillCardRenderer';

interface BotDashboardChatProps {
  tenantId: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  responseType?: string;
  skillCard?: any;
  skillName?: string | null;
}

const SUGGESTED_PROMPTS = [
  'What features do I have available?',
  'What should I set up next?',
  'How do I improve my storefront?',
  'What is my current tier?',
];

export default function BotDashboardChat({ tenantId }: BotDashboardChatProps) {
  const { data: chatbotCaps, loading: capsLoading } = useChatbotOptionsCapability(tenantId);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const botEnabled = chatbotCaps?.enabled && chatbotCaps?.chatbotAvailable;

  const startChat = useCallback(async () => {
    if (sessionId) return;
    setError(null);
    try {
      const result = await botService.startDashboardChat(tenantId);
      setSessionId(result.sessionId);
      setMessages([{ role: 'assistant', content: result.greeting }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start chat');
    }
  }, [tenantId, sessionId]);

  const toggleChat = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !sessionId) {
      startChat();
    }
  }, [isOpen, sessionId, startChat]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !sessionId || sending) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setSending(true);
    setError(null);

    try {
      const result = await botService.sendDashboardMessage(tenantId, sessionId, trimmed);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.reply,
        responseType: result.responseType,
        skillCard: result.skillCard,
        skillName: result.skillName,
      }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
        responseType: 'fallback',
      }]);
    } finally {
      setSending(false);
    }
  }, [tenantId, sessionId, sending]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (capsLoading) {
    return null;
  }

  if (!botEnabled) {
    return null;
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-3 text-white shadow-lg hover:bg-indigo-700 transition-colors"
        aria-label="Toggle platform assistant"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        {!isOpen && <span className="text-sm font-medium">Ask Assistant</span>}
      </button>

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white shadow-xl flex flex-col" style={{ maxHeight: '600px' }}>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                <Sparkles className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">Platform Assistant</div>
                <div className="text-xs text-gray-400">Tier-aware guidance</div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="ml-auto text-gray-400 hover:text-gray-600"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ minHeight: '300px' }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'rounded-br-sm'
                      : msg.responseType === 'fallback'
                      ? 'bg-gray-100 text-gray-600 rounded-bl-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  }`}
                  style={msg.role === 'user' ? {
                    background: '#4F46E5' + '1A',
                    border: '1px solid #4F46E540',
                    color: '#4F46E5',
                  } : undefined}
                >
                  {msg.content}

                  {msg.skillCard && (
                    <SkillCardRenderer card={msg.skillCard} />
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-gray-100 px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-red-500 text-center">{error}</div>
            )}
          </div>

          {/* Suggested prompts (shown when only greeting is present) */}
          {messages.length === 1 && !sending && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your platform features..."
                rows={1}
                className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                style={{ maxHeight: '100px' }}
                disabled={sending}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || sending}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
