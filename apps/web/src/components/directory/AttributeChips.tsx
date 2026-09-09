import type { DirectoryListingAttribute } from '@/services/DirectoryPresenceAdminService';

/**
 * Sourced attribute chips for public listing surfaces (migration 267).
 *
 * Each chip carries its own evidence — source platform + URL + as_of date as
 * recorded by the analyst — surfaced as the chip's tooltip. Never inferred
 * from category labels. SNAP/EBT keeps its dedicated badge and is not
 * duplicated here.
 *
 * Shared by the directory entry layouts; reusable on queue cards, campaign
 * cards, and claim summaries as those surfaces adopt attributes.
 */
export default function AttributeChips({
  attributes,
  size = 'sm',
  className = '',
}: {
  attributes: Array<DirectoryListingAttribute | Record<string, any>> | null | undefined;
  size?: 'xs' | 'sm';
  className?: string;
}) {
  const attrs = Array.isArray(attributes) ? attributes : [];
  if (attrs.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 mt-2 ${className}`.trim()}>
      {attrs.map((attr: any, idx: number) => {
        const evidence = [
          attr.sourcePlatform ? `Reported by ${String(attr.sourcePlatform).replace(/_/g, ' ')}` : null,
          attr.asOf ? `as of ${attr.asOf}` : null,
        ].filter(Boolean).join(' · ');
        return (
          <span
            key={attr.key || idx}
            className={`inline-flex items-center gap-1 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-200 ${
              size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
            }`}
            title={evidence ? `${attr.label} — ${evidence}` : attr.label}
          >
            {attr.label}
          </span>
        );
      })}
    </div>
  );
}
