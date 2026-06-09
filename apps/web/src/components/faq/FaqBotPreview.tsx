'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { MessageSquare, Send, Loader2, ThumbsUp, ThumbsDown, HelpCircle, AlertTriangle, PlusCircle } from 'lucide-react';
import { faqService, FaqItem } from '@/services/FaqService';

interface MatchResult {
  faq: FaqItem;
  score: number;
  method: 'keyword' | 'exact';
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  matches?: MatchResult[];
  noMatch?: boolean;
}

interface FaqBotPreviewProps {
  tenantId: string;
}

export default function FaqBotPreview({ tenantId }: FaqBotPreviewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      // Static keyword match for Free tier
      const faqs = await faqService.listFAQs(tenantId, { scope: 'storefront', status: 'active' });
      const query = question.toLowerCase();
      const words = query.split(/\s+/).filter((w) => w.length > 2);

      const scored: MatchResult[] = faqs
        .map((faq) => {
          const qLower = faq.question.toLowerCase();
          const aLower = faq.answer.toLowerCase();
          let score = 0;
          let exactMatch = false;

          // Exact substring match
          if (qLower.includes(query) || aLower.includes(query)) {
            score = 1.0;
            exactMatch = true;
          } else {
            // Keyword match
            let matched = 0;
            for (const word of words) {
              if (qLower.includes(word)) matched += 2; // question match worth more
              else if (aLower.includes(word)) matched += 1;
              else if (faq.tags?.some((t) => t.toLowerCase().includes(word))) matched += 1;
            }
            score = words.length > 0 ? matched / (words.length * 2) : 0;
          }

          return {
            faq,
            score,
            method: exactMatch ? 'exact' : 'keyword',
          } as MatchResult;
        })
        .filter((m) => m.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      const topMatch = scored[0];
      const isNoMatch = !topMatch || topMatch.score < 0.2;
      const botContent = isNoMatch
        ? "I couldn't find a matching FAQ for that question."
        : topMatch.faq.answer;

      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: botContent,
          matches: scored,
          noMatch: isNoMatch,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'bot', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
      {/* Left: Chat Input */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            Test Questions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 mb-3">
            {messages.length === 0 && (
              <div className="text-center text-neutral-400 py-12">
                <HelpCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Type a question to test how your bot would respond</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`p-3 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-50 text-blue-900 ml-8'
                    : msg.noMatch
                    ? 'bg-amber-50 text-amber-900 mr-8 border border-amber-200'
                    : 'bg-neutral-50 text-neutral-800 mr-8'
                }`}
              >
                {msg.content}
                {msg.noMatch && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-amber-700">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Consider adding this question to your FAQ knowledge base.</span>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="bg-neutral-50 p-3 rounded-lg mr-8">
                <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <Button size="sm" onClick={handleSend} disabled={loading || !input.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Right: Match Results */}
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-green-600" />
            Matched Results
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {messages.filter((m) => m.role === 'bot' && m.matches).length === 0 ? (
            <div className="text-center text-neutral-400 py-12">
              <p className="text-sm">Matches will appear here after you ask a question</p>
            </div>
          ) : (
            messages
              .filter((m) => m.role === 'bot' && m.matches)
              .slice(-1)[0]
              ?.matches?.map((match, i) => {
                const pct = match.score * 100;
                const confidence = pct >= 70 ? 'high' : pct >= 40 ? 'medium' : 'low';
                const colorMap = {
                  high: { border: 'border-green-200', bg: 'bg-green-50', badge: 'border-green-300 text-green-700', dot: 'bg-green-500', label: 'High' },
                  medium: { border: 'border-amber-200', bg: 'bg-amber-50', badge: 'border-amber-300 text-amber-700', dot: 'bg-amber-500', label: 'Medium' },
                  low: { border: 'border-red-200', bg: 'bg-red-50', badge: 'border-red-300 text-red-700', dot: 'bg-red-500', label: 'Low' },
                };
                const c = colorMap[confidence];
                return (
                <div
                  key={i}
                  className={`p-4 rounded-lg border mb-3 ${c.border} ${c.bg}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={c.badge}>
                      #{i + 1} Match
                    </Badge>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {match.method}
                      </Badge>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                        <span className={`text-xs font-medium ${c.badge.split(' ')[1]}`}>{c.label}</span>
                      </div>
                      <span className="text-sm font-medium text-neutral-700">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-neutral-900 mb-1">{match.faq.question}</p>
                  <p className="text-xs text-neutral-500 line-clamp-2">{match.faq.answer}</p>
                </div>
              );})
          )}
        </CardContent>
      </Card>
    </div>
  );
}
