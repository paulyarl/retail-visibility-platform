"use client";

interface SyncStatusIndicatorProps {
  itemStatus?: 'active' | 'inactive' | 'syncing' | 'archived' | 'draft';
  visibility?: 'public' | 'private';
  categoryPath?: string[];
  showDetails?: boolean;
}

export default function SyncStatusIndicator({ 
  itemStatus, 
  visibility, 
  categoryPath,
  showDetails = false 
}: SyncStatusIndicatorProps) {
  const isActive = itemStatus === 'active';
  const isArchived = itemStatus === 'archived';
  const isInactive = itemStatus === 'inactive';
  const isDraft = itemStatus === 'draft';
  const isPublic = visibility === 'public';
  const hasCategory = categoryPath && categoryPath.length > 0;
  
  const willSync = isActive && isPublic && hasCategory;
  
  // Determine blocking reasons with actionable instructions
  const blockingReasons: string[] = [];
  if (isDraft) blockingReasons.push('Item is Draft (click Draft to activate)');
  if (isArchived) blockingReasons.push('Item is Archived (click Archived to restore)');
  if (isInactive) blockingReasons.push('Item is Inactive (click Inactive to activate)');
  if (!isPublic) blockingReasons.push('Item is Private (click Private to make Public)');
  if (!hasCategory) blockingReasons.push('No category assigned (click Category to assign)');
  
  // Warning reasons (won't block sync but may cause issues)
  const warnings: string[] = [];
  // Currently no warnings - category is now a blocker

  if (willSync) {
    return (
      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
        <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        <span className="text-xs sm:text-sm font-medium hidden sm:inline">Syncing to Google</span>
        <span className="text-xs font-medium sm:hidden">✓ Sync</span>
      </div>
    );
  }

  // Not syncing - show visual indicators for blockers
  const isIntentionalBlock = isDraft || isArchived || isInactive || !isPublic;
  const colorClass = isIntentionalBlock 
    ? 'text-red-600 dark:text-red-500' 
    : 'text-amber-600 dark:text-amber-500';
  
  return (
    <div className="flex items-center gap-1.5">
      {/* Main status icon */}
      <svg className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 ${colorClass}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      
      {/* Desktop: Show text */}
      <span className={`text-xs sm:text-sm font-medium hidden sm:inline ${colorClass}`}>
        Not syncing
      </span>
      
      {/* Mobile: Show compact visual blockers */}
      <div className="flex items-center gap-1 sm:hidden">
        {isDraft && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" title="Draft">
            ✏️
          </span>
        )}
        {isArchived && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" title="Archived">
            📦
          </span>
        )}
        {isInactive && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-900/30 text-neutral-700 dark:text-neutral-300" title="Inactive">
            ⏸️
          </span>
        )}
        {!isPublic && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" title="Private">
            🔒
          </span>
        )}
        {!hasCategory && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300" title="No category">
            🏷️
          </span>
        )}
      </div>
      
      {/* Desktop: Show detailed reasons if requested */}
      {showDetails && blockingReasons.length > 0 && (
        <div className="hidden sm:flex items-center gap-1.5 ml-2">
          {isDraft && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
              Draft
            </span>
          )}
          {isArchived && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              Archived
            </span>
          )}
          {isInactive && (
            <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-900/30 text-neutral-700 dark:text-neutral-300">
              Inactive
            </span>
          )}
          {!isPublic && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              Private
            </span>
          )}
          {!hasCategory && (
            <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
              No category
            </span>
          )}
        </div>
      )}
    </div>
  );
}
