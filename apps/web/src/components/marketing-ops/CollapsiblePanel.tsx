'use client';

import { ReactNode, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * CollapsiblePanel — disclosure wrapper for the tall briefing/report panels
 * on the business-campaign Overview tab (repair track / triage briefing /
 * website gap / archetype briefing / owner report). Collapsed by default so
 * the overview stays scannable; the operator expands a panel only when the
 * detail is needed.
 *
 * The body stays mounted while collapsed (`hidden`, not conditional render)
 * so in-progress state — pasted external output, rendered prompts, minted
 * share links — survives a collapse/expand cycle.
 *
 * `headerRight` holds actions that stay reachable while collapsed (e.g.
 * Switch Track, Refresh preview). If such an action opens an inline form
 * inside the body, pair it with the controlled `expanded`/`onExpandedChange`
 * props so the action can force the panel open (see RepairTrackPanel).
 *
 * `collapsible={false}` renders the same card chrome with a static header
 * and always-visible body — for panels embedded inside another collapsible
 * (RepairBriefingCard inside ArchetypeBriefingPanel), where a nested
 * disclosure would bury the result the operator just expanded to see.
 */
interface CollapsiblePanelProps {
  icon: ReactNode;
  title: ReactNode;
  titleExtra?: ReactNode;
  subtitle?: ReactNode;
  headerRight?: ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
}

export default function CollapsiblePanel({
  icon,
  title,
  titleExtra,
  subtitle,
  headerRight,
  collapsible = true,
  defaultExpanded = false,
  expanded,
  onExpandedChange,
  children,
}: CollapsiblePanelProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expanded !== undefined;
  const isExpanded = !collapsible || (isControlled ? expanded : internalExpanded);
  const bodyId = useId();

  const toggle = () => {
    if (!collapsible) return;
    const next = !isExpanded;
    if (!isControlled) setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  const titleContent = (
    <>
      {icon}
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
          {titleExtra}
        </span>
        {subtitle && (
          <span className="block text-[11px] font-normal text-gray-500 dark:text-gray-400">
            {subtitle}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-xl border border-gray-200 dark:border-neutral-700 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="m-0 min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white">
          {collapsible ? (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={isExpanded}
              aria-controls={bodyId}
              className="flex w-full min-w-0 items-center gap-2 rounded-md text-left"
            >
              <ChevronDown
                className={`w-4 h-4 shrink-0 text-gray-400 dark:text-gray-500 transition-transform ${
                  isExpanded ? '' : '-rotate-90'
                }`}
              />
              {titleContent}
            </button>
          ) : (
            <span className="flex items-center gap-2">{titleContent}</span>
          )}
        </h3>
        {headerRight && <div className="flex shrink-0 items-center gap-2">{headerRight}</div>}
      </div>
      <div id={bodyId} className={isExpanded ? 'mt-4' : 'hidden'}>
        {children}
      </div>
    </div>
  );
}
