'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface DirectoryKeywordTagsProps {
  keywords: string[];
  className?: string;
}

export default function DirectoryKeywordTags({ keywords, className = '' }: DirectoryKeywordTagsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (!keywords || keywords.length === 0) {
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
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {keywords.map((keyword, index) => (
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
  );
}
