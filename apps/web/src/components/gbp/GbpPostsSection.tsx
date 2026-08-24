'use client';

import { useEffect, useState } from 'react';
import { FileText, Tag, Calendar, ArrowRight } from 'lucide-react';

interface GbpPost {
  id: string;
  topicType: string | null;
  summary: string;
  mediaUrl: string | null;
  callToActionType: string | null;
  callToActionUrl: string | null;
  eventTitle: string | null;
  eventStartDate: string | null;
  eventEndDate: string | null;
  offerCouponCode: string | null;
  offerRedeemUrl: string | null;
  offerTerms: string | null;
  publishedAt: string | null;
}

interface GbpPostsData {
  enabled: boolean;
  posts: GbpPost[];
}

interface GbpPostsSectionProps {
  slug: string;
}

export function GbpPostsSection({ slug }: GbpPostsSectionProps) {
  const [data, setData] = useState<GbpPostsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/directory/${encodeURIComponent(slug)}/gbp-posts`);
        const json = await res.json();
        if (!cancelled && json.success) {
          setData(json.data);
        }
      } catch {
        // Silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading || !data || !data.enabled || data.posts.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Latest Posts
        </h2>
        <span className="text-xs text-gray-400 ml-1">from Google</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.posts.slice(0, 6).map((post) => {
          const topicType = post.topicType || 'STANDARD';
          const isEvent = topicType === 'EVENT';
          const isOffer = topicType === 'OFFER';
          const Icon = isEvent ? Calendar : isOffer ? Tag : FileText;

          return (
            <div key={post.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {post.mediaUrl && (
                <div className="aspect-video bg-gray-100 dark:bg-gray-900">
                  <img src={post.mediaUrl} alt={post.summary.slice(0, 50)} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {isEvent ? 'Event' : isOffer ? 'Offer' : "What's New"}
                  </span>
                </div>

                {isEvent && post.eventTitle && (
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{post.eventTitle}</h3>
                )}

                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 mb-3">{post.summary}</p>

                {isEvent && post.eventStartDate && (
                  <p className="text-xs text-gray-500 mb-2">
                    {new Date(post.eventStartDate).toLocaleDateString()}
                    {post.eventEndDate && ` – ${new Date(post.eventEndDate).toLocaleDateString()}`}
                  </p>
                )}

                {isOffer && post.offerCouponCode && (
                  <div className="mb-2">
                    <span className="inline-block text-xs font-mono font-medium px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      Code: {post.offerCouponCode}
                    </span>
                  </div>
                )}

                {post.callToActionUrl && (
                  <a
                    href={post.callToActionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    {post.callToActionType || 'Learn more'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                )}

                {post.publishedAt && (
                  <p className="text-xs text-gray-400 mt-2">{new Date(post.publishedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
