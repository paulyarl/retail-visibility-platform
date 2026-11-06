'use client';

/**
 * PlacePostsSection — owner-authored dated updates on the claimed directory
 * entry (TENANT_CONTENT_HUB_SPEC Phase 2). Mounted once in StoreDetailClient
 * so all three claimed layouts (classic/editorial/immersive) get it.
 * Self-gates on the public route's `enabled` flag — renders nothing when the
 * tier lacks directory_entry_posts_on or there are no posts.
 */

import { useEffect, useState } from 'react';
import { placePostsService, type PlacePost } from '@/services/PlacePostsService';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function PlacePostsSection({ tenantId }: { tenantId: string }) {
  const [posts, setPosts] = useState<PlacePost[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    placePostsService
      .getPosts(tenantId)
      .then((p) => {
        if (!cancelled) setPosts(p.enabled ? p.posts : []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (!posts || posts.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 mb-6">
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <h2 className="px-6 pt-5 text-lg font-semibold text-neutral-900">Updates</h2>
        <ul className="divide-y divide-neutral-100">
          {posts.map((post) => (
            <li key={post.id} className="px-6 py-4">
              {post.media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.media_url} alt="" className="mb-3 max-h-64 rounded-lg object-cover" />
              ) : null}
              <p className="text-sm text-neutral-800 whitespace-pre-line">{post.body}</p>
              <p className="mt-1.5 text-xs text-neutral-400">
                {post.pinned ? '📌 ' : ''}
                {formatDate(post.published_at)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
