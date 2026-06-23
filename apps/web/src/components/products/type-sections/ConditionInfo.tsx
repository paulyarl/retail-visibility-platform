'use client';

interface ConditionInfoProps {
  product: any;
  layoutVariant?: 'classic' | 'showcase' | 'quick-commerce';
}

export function ConditionInfo({
  product,
  layoutVariant = 'classic',
}: ConditionInfoProps) {
  if (!product.condition) return null;

  const conditionLabels: Record<string, string> = {
    new: 'New',
    brand_new: 'Brand New',
    used: 'Used',
    refurbished: 'Refurbished',
    open_box: 'Open Box',
  };

  const label = conditionLabels[product.condition] || product.condition.charAt(0).toUpperCase() + product.condition.slice(1);
  const isCompact = layoutVariant === 'quick-commerce';

  return (
    <div className={`flex items-center gap-2 ${isCompact ? 'text-xs' : 'text-sm'}`}>
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
        {label}
      </span>
    </div>
  );
}
