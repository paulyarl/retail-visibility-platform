'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/components/ui/Badge';

interface DirectoryPopularTagsProps {
  listings: any[];
  className?: string;
}

export default function DirectoryPopularTags({ listings, className = '' }: DirectoryPopularTagsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Extract all keywords from listings
  const allKeywords = listings?.flatMap(listing => listing.keywords || []) || [];
  
  // Count keyword frequency
  const keywordCounts = allKeywords.reduce((acc: Record<string, number>, keyword) => {
    acc[keyword] = (acc[keyword] || 0) + 1;
    return acc;
  }, {});

  // Sort by frequency and take top 12
  const popularKeywords = Object.entries(keywordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12)
    .map(([keyword]) => keyword);

  if (popularKeywords.length === 0) {
    return null;
  }

  const handleKeywordClick = (keyword: string) => {
    const params = new URLSearchParams(searchParams.toString());

    // Set the search query to this keyword
    params.set('q', keyword);

    // Reset to page 1 when filtering
    params.set('page', '1');

    // Navigate with new search params
    router.push(`/directory?${params.toString()}`);
  };

  return (
    <div className={`mb-6 ${className}`}>
      <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
        Popular Searches
      </h3>
      <div className="flex flex-wrap gap-2">
        {popularKeywords.map((keyword, index) => (
          <button
            key={`${keyword}-${index}`}
            onClick={() => handleKeywordClick(keyword)}
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                     bg-blue-50 text-blue-700 hover:bg-blue-100
                     border border-blue-200 hover:border-blue-300
                     transition-colors duration-200 ease-in-out
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
            title={`Search for stores with "${keyword}"`}
          >
            <span className="mr-1">#</span>
            {keyword}
          </button>
        ))}
      </div>
    </div>
  );
}
