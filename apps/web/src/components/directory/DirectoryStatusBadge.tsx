'use client';

interface DirectoryStatusBadgeProps {
  isPublished: boolean;
  isFeatured?: boolean;
  className?: string;
}

export default function DirectoryStatusBadge({ 
  isPublished, 
  isFeatured,
  className = '' 
}: DirectoryStatusBadgeProps) {
  if (isFeatured) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 ${className}`}>
        ⭐ Featured
      </span>
    );
  }

  if (isPublished) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 ${className}`}>
        ✓ Published
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 ${className}`}>
      Draft
    </span>
  );
}
