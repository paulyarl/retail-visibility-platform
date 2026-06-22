'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { MessageSquare, Send, Loader2, HelpCircle, AlertTriangle, PlusCircle } from 'lucide-react';
import { getContrastColor } from '@/lib/color-utils';

interface PreviewResult {
  reply: string;
  responseType: string;
  matchedFaqId: string | null;
}

interface ChatMessage {
  role: 'user' | 'bot';
  content: string;
  result?: PreviewResult;
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
      const resp = await fetch('/api/public/bot/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, message: question, pageContext: 'storefront' }),
      });

      if (!resp.ok) throw new Error('Preview request failed');
      const data = await resp.json();

      if (!data.success) {
        throw new Error(data.message || 'Preview failed');
      }

      const result: PreviewResult = {
        reply: data.reply,
        responseType: data.responseType,
        matchedFaqId: data.matchedFaqId,
      };

      const isNoMatch = result.responseType === 'fallback';

      setMessages((prev) => [
        ...prev,
        {
          role: 'bot',
          content: result.reply,
          result,
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
                    ? 'ml-8'
                    : msg.noMatch
                    ? 'bg-amber-50 text-amber-900 mr-8 border border-amber-200'
                    : 'bg-neutral-50 text-neutral-800 mr-8'
                }`}
                style={msg.role === 'user' ? {
                  background: '#3B82F6' + '1A',
                  border: '1px solid #3B82F640',
                  color: '#3B82F6',
                } : undefined}
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
            Match Results
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          {messages.filter((m) => m.role === 'bot' && m.result).length === 0 ? (
            <div className="text-center text-neutral-400 py-12">
              <p className="text-sm">Match results will appear here after you ask a question</p>
            </div>
          ) : (
            messages
              .filter((m) => m.role === 'bot' && m.result)
              .slice(-1)[0]
              ?.result && (
                <div className={`p-4 rounded-lg border mb-3 ${
                  messages.slice(-1)[0]?.noMatch
                    ? 'border-amber-200 bg-amber-50'
                    : 'border-green-200 bg-green-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      {messages.slice(-1)[0]?.result?.responseType || 'unknown'}
                    </Badge>
                    {messages.slice(-1)[0]?.result?.matchedFaqId && (
                      <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                        FAQ Matched
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium text-neutral-900 mb-1">
                    {messages.slice(-1)[0]?.result?.reply}
                  </p>
                </div>
              )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
