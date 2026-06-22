'use client';

import { CheckCircle2, Circle, Lightbulb, BadgeCheck, Layers } from 'lucide-react';

interface SkillCard {
  type?: string;
  title?: string;
  body?: string;
  sections?: Array<{
    label: string;
    value?: string;
    icon?: string;
    items?: string[];
  }>;
}

interface SkillCardRendererProps {
  card: SkillCard;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  badge: BadgeCheck,
  check: CheckCircle2,
  circle: Circle,
  lightbulb: Lightbulb,
  layers: Layers,
};

export default function SkillCardRenderer({ card }: SkillCardRendererProps) {
  if (!card) return null;

  // Generic fallback: title + body
  if (!card.sections || card.sections.length === 0) {
    return (
      <div className="mt-2 p-2 bg-neutral-100 dark:bg-neutral-600 rounded-lg text-xs">
        {card.title && <div className="font-semibold mb-1">{card.title}</div>}
        {card.body && <div className="text-neutral-600 dark:text-neutral-300">{card.body}</div>}
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 bg-neutral-50 dark:bg-neutral-600/50 rounded-lg border border-neutral-200 dark:border-neutral-600 text-xs space-y-2.5">
      {card.title && (
        <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          {card.title}
        </div>
      )}
      {card.sections.map((section, i) => {
        const Icon = ICON_MAP[section.icon || ''] || null;
        return (
          <div key={i}>
            <div className="font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-1 mb-0.5">
              {Icon && <Icon className="w-3 h-3 text-indigo-500" />}
              {section.label}
            </div>
            {section.value && (
              <div className="text-neutral-600 dark:text-neutral-300 pl-4">{section.value}</div>
            )}
            {section.items && section.items.length > 0 && (
              <ul className="pl-4 space-y-0.5">
                {section.items.map((item, j) => (
                  <li key={j} className="text-neutral-600 dark:text-neutral-300 flex items-start gap-1">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
