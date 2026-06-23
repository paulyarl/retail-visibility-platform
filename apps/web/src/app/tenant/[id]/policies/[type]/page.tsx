'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';
import { publicStorefrontPolicyService, PolicyType } from '@/services/PublicStorefrontPolicyService';

const POLICY_META: Record<string, { title: string; fallback: string }> = {
  return_policy: { title: 'Return Policy', fallback: 'Return policy has not been configured yet.' },
  shipping_policy: { title: 'Shipping Policy', fallback: 'Shipping policy has not been configured yet.' },
  privacy_policy: { title: 'Privacy Policy', fallback: 'Privacy policy has not been configured yet.' },
  terms_of_service: { title: 'Terms of Service', fallback: 'Terms of service have not been configured yet.' },
  refund_policy: { title: 'Refund Policy', fallback: 'Refund policy has not been configured yet.' },
};

export default function PublicPolicyPage() {
  const params = useParams();
  const tenantId = params.id as string;
  const policyType = params.type as string;

  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const meta = POLICY_META[policyType] || { title: 'Policy', fallback: 'Policy not found.' };

  useEffect(() => {
    if (!tenantId || !policyType) return;
    fetchPolicy();
  }, [tenantId, policyType]);

  const fetchPolicy = async () => {
    try {
      setLoading(true);
      const result = await publicStorefrontPolicyService.getPolicy(tenantId, policyType as PolicyType);
      if (result) {
        setContent(result);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Error fetching policy:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 bg-neutral-200 rounded w-64 mb-4"></div>
          <div className="h-4 bg-neutral-200 rounded w-96"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href={`/tenant/${tenantId}`} className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to Store</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="h-7 w-7 text-neutral-400" />
            <h1 className="text-3xl font-bold text-neutral-900">{meta.title}</h1>
          </div>

          {notFound || !content ? (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-8 text-center">
              <p className="text-neutral-500">{meta.fallback}</p>
              <p className="text-neutral-400 text-sm mt-2">
                Please contact the store directly for more information.
              </p>
            </div>
          ) : (
            <div className="prose prose-neutral max-w-none">
              <MarkdownRenderer content={content} />
            </div>
          )}

          {/* Policy navigation */}
          <div className="mt-12 pt-8 border-t border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Other Policies</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(POLICY_META).map(([key, m]) => (
                key !== policyType && (
                  <Link
                    key={key}
                    href={`/tenant/${tenantId}/policies/${key}`}
                    className="px-3 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                  >
                    {m.title}
                  </Link>
                )
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const html = renderMarkdown(content);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderMarkdown(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul class="list-disc list-inside space-y-1 my-4">${match}</ul>`);

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = `<p>${html}</p>`;
  html = html.replace(/<p><h/g, '<h').replace(/<\/h(\d)><\/p>/g, '</h$1>');
  html = html.replace(/<p><ul/g, '<ul').replace(/<\/ul><\/p>/g, '</ul>');

  return html;
}
