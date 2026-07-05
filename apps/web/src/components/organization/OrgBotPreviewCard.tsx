"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Bot, MessageSquare, Send, Sparkles, X, Loader2, Link2,
  FileQuestion, Package, Lock,
} from "lucide-react";
import SkillCardRenderer from "@/components/bot/SkillCardRenderer";
import { orgCapabilityService } from "@/services/OrgCapabilityService";
import type { OrgBotStatus } from "@/services/OrgCapabilityService";

interface OrgBotPreviewCardProps {
  data: OrgBotStatus | undefined;
  loading?: boolean;
  organizationId: string;
  orgName?: string;
  readOnly?: boolean;
  isPlatformAdmin?: boolean;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  responseType?: string;
  skillCard?: any;
  skillName?: string | null;
}

const SUGGESTED_PROMPTS = [
  "What locations do I have?",
  "Which locations have chatbot enabled?",
  "How do I propagate products to all locations?",
];

export default function OrgBotPreviewCard({
  data,
  loading,
  organizationId,
  orgName,
  readOnly = false,
  isPlatformAdmin = false,
}: OrgBotPreviewCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canChat = !readOnly || isPlatformAdmin;

  const startChat = useCallback(async () => {
    if (sessionId) return;
    setError(null);
    try {
      const result = await orgCapabilityService.startOrgBotChat(organizationId);
      setSessionId(result.sessionId);
      setMessages([{ role: "assistant", content: result.greeting }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start chat");
    }
  }, [organizationId, sessionId]);

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

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setSending(true);
    setError(null);

    try {
      const result = await orgCapabilityService.sendOrgBotMessage(organizationId, sessionId, trimmed);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.reply,
          responseType: result.responseType,
          skillCard: result.skillCard,
          skillName: result.skillName,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I had trouble processing that. Please try again.", responseType: "fallback" },
      ]);
    } finally {
      setSending(false);
    }
  }, [organizationId, sessionId, sending]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Loading state
  if (loading || !data) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <div className="h-6 w-32 animate-pulse bg-gray-100 dark:bg-gray-800 rounded mb-3" />
          <div className="h-24 animate-pulse bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
      </motion.div>
    );
  }

  // No locations
  if (data.totalLocations === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 text-center">
          <Bot className="w-7 h-7 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No locations in this organization.</p>
        </div>
      </motion.div>
    );
  }

  const allActive = data.totalActive === data.totalLocations;
  const noneActive = data.totalActive === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Chatbot Status</h3>
            <span
              className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                allActive
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                  : noneActive
                    ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
            >
              {data.totalActive}/{data.totalLocations} active
            </span>
          </div>
        </div>

        {/* Location rows */}
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {data.locations.slice(0, 4).map((loc) => (
            <div key={loc.tenantId} className="px-5 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    loc.botActive ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-700"
                  }`}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                  {loc.tenantName}
                </span>
                <Link
                  href={`/t/${loc.tenantId}/bot`}
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
                >
                  <Link2 className="w-3 h-3" />
                  Manage
                </Link>
              </div>
              <div className="flex items-center gap-3 ml-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  {loc.conversationCount} conv.
                </span>
                <span className={`inline-flex items-center gap-1 ${loc.hasFaqEmbeddings ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 dark:text-amber-500"}`}>
                  <FileQuestion className="w-3 h-3" />
                  FAQ KB
                </span>
                <span className={`inline-flex items-center gap-1 ${loc.hasProductEmbeddings ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500 dark:text-amber-500"}`}>
                  <Package className="w-3 h-3" />
                  Product KB
                </span>
              </div>
            </div>
          ))}
          {data.locations.length > 4 && (
            <div className="px-5 py-2 text-center">
              <span className="text-xs text-gray-400">+{data.locations.length - 4} more locations</span>
            </div>
          )}
        </div>

        {/* Inline Chatbot Preview */}
        {canChat && data.totalActive > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800">
            {/* Toggle button */}
            {!isOpen ? (
              <button
                onClick={toggleChat}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Test {orgName ? `${orgName} Assistant` : "Org Assistant"}
              </button>
            ) : (
              <div className="p-4">
                {/* Chat header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {orgName ? `${orgName} Assistant` : "Organization Assistant"}
                  </span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Messages */}
                <div
                  ref={scrollRef}
                  className="space-y-2 max-h-64 overflow-y-auto mb-3"
                >
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "rounded-br-sm"
                            : msg.responseType === "fallback"
                              ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-bl-sm"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm"
                        }`}
                        style={
                          msg.role === "user"
                            ? { background: "#4F46E51A", border: "1px solid #4F46E540", color: "#4F46E5" }
                            : undefined
                        }
                      >
                        {msg.content}
                        {msg.skillCard && <SkillCardRenderer card={msg.skillCard} />}
                      </div>
                    </div>
                  ))}
                  {sending && (
                    <div className="flex justify-start">
                      <div className="rounded-xl bg-gray-100 dark:bg-gray-800 px-3 py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-gray-500 dark:text-gray-400" />
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-xs text-red-500">{error}</span>
                      <button
                        onClick={() => sendMessage(messages[messages.length - 2]?.content || "")}
                        className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Suggested prompts */}
                {messages.length === 1 && !sending && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {SUGGESTED_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => sendMessage(prompt)}
                        className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your locations..."
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    style={{ maxHeight: "100px" }}
                    disabled={sending}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || sending}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Read-only fallback */}
        {!canChat && data.totalActive > 0 && (
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 flex items-center gap-2 text-gray-400">
            <Lock className="w-3.5 h-3.5" />
            <span className="text-xs">Chat preview available to org admins</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
