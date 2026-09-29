/**
 * ProspectReportView — the shared owner-facing report renderer.
 *
 * Pure render of the ProspectReport DTO (§6 structure): header → short
 * version → chapters → locked teasers → "how this report was made" → CTA.
 * Used identically by the operator panel preview (recipient view) and the
 * public /prospect-report/[token] page — the operator always sees exactly
 * what the recipient will see for the current selection.
 *
 * Owner-safety: the DTO is safe-by-construction (deterministic transform),
 * so this component renders what it's given — no internal-field guards are
 * needed here; they're enforced upstream in ProspectReportService.
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md §6
 */

import {
  AlertTriangle,
  CheckCircle2,
  Globe,
  Lock,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import type {
  ProspectReport,
  ProspectReportWebsiteChapter,
} from '@/services/ProspectReportPublicService';

/**
 * Chapter body — every registered chapter renders this same shape (verdict /
 * already working / costing customers / expectations / competitive frame /
 * fix); only the title and content differ by audit source.
 */
function ReportChapter({ chapter }: { chapter: ProspectReportWebsiteChapter }) {
  const now = chapter.costing_customers.filter((i) => i.tier === 'now');
  const worthFixing = chapter.costing_customers.filter((i) => i.tier === 'worth_fixing');
  const category = chapter.category ?? 'your category';

  return (
    <section className="space-y-4" data-chapter={chapter.chapter_id}>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-neutral-700 pb-2">
        {chapter.title}
      </h2>

      {/* Verdict */}
      <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
        {chapter.verdict}
      </p>

      {/* Already working — leads with what's right before what's wrong (§3.3) */}
      {chapter.already_working.length > 0 && (
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/60 dark:bg-emerald-900/10 p-3.5">
          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Already working
          </p>
          <ul className="space-y-1.5">
            {chapter.already_working.map((line, i) => (
              <li key={i} className="text-xs text-emerald-900 dark:text-emerald-200 flex gap-1.5">
                <span className="text-emerald-500 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What's costing you customers */}
      {(now.length > 0 || worthFixing.length > 0) && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            What's costing you customers
          </p>
          {now.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Costing you customers now
              </p>
              {now.map((issue, i) => (
                <IssueCard key={i} issue={issue} urgent />
              ))}
            </div>
          )}
          {worthFixing.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Worth fixing
              </p>
              {worthFixing.map((issue, i) => (
                <IssueCard key={i} issue={issue} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unmet category expectations (§3.3 unmet rows) */}
      {chapter.expectations.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            What {category.toLowerCase()} customers expect
          </p>
          {chapter.expectations.map((gap, i) => (
            <div
              key={i}
              className="rounded-lg border border-gray-200 dark:border-neutral-700 p-3 space-y-1"
            >
              <p className="text-xs font-medium text-gray-900 dark:text-gray-100">
                {gap.field} — customers expect {gap.expected_text}; your site shows {gap.actual_text}.
              </p>
              {gap.note && (
                <p className="text-[11px] text-gray-600 dark:text-gray-400">{gap.note}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* What leading businesses do */}
      {chapter.competitive_frame.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
            What leading {category.toLowerCase()} businesses do
          </p>
          <ul className="space-y-1">
            {chapter.competitive_frame.map((line, i) => (
              <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex gap-1.5">
                <span className="text-sky-500 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The fix — delivery-mode reframe (§4); the noun is always the new site */}
      <div className="rounded-lg border border-sky-200 dark:border-sky-800/50 bg-sky-50/50 dark:bg-sky-950/10 p-3.5 space-y-2">
        <p className="text-xs font-semibold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
          <Wrench className="w-3.5 h-3.5" />
          The fix
        </p>
        <p className="text-sm text-sky-900 dark:text-sky-200">{chapter.fix.headline}</p>
        {chapter.fix.scope_notes && (
          <p className="text-xs text-gray-700 dark:text-gray-300">{chapter.fix.scope_notes}</p>
        )}
        {chapter.fix.page_plan && chapter.fix.page_plan.length > 0 && (
          <div>
            <p className="text-[11px] font-medium text-sky-700 dark:text-sky-400 mb-1">
              What the new site includes
            </p>
            <ul className="space-y-1">
              {chapter.fix.page_plan.map((page, i) => (
                <li key={i} className="text-xs text-gray-700 dark:text-gray-300 flex gap-1.5">
                  <span className="text-sky-500 shrink-0">•</span>
                  <span>{page}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function IssueCard({
  issue,
  urgent,
}: {
  issue: ProspectReportWebsiteChapter['costing_customers'][number];
  urgent?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-1 ${
        urgent
          ? 'border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/10'
          : 'border-gray-200 dark:border-neutral-700'
      }`}
    >
      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{issue.headline}</p>
      {issue.cost && (
        <p className="text-xs text-gray-700 dark:text-gray-300">
          <span className="font-medium">What it costs you: </span>
          {issue.cost}
        </p>
      )}
      {issue.evidence && (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          <span className="font-medium">Where we saw it: </span>
          {issue.evidence}
        </p>
      )}
    </div>
  );
}

export default function ProspectReportView({ report }: { report: ProspectReport }) {
  const prepared = new Date(report.prepared_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 bg-white dark:bg-neutral-900 text-left">
      {/* Header */}
      <header className="space-y-1 border-b border-gray-200 dark:border-neutral-700 pb-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
          <Globe className="w-3.5 h-3.5" />
          Business Visibility Report
        </p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          {report.business_name}
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Prepared {prepared}
          {report.website_url ? ` · ${report.website_url}` : ''}
        </p>
      </header>

      {/* The short version */}
      {(report.short_version.lead || report.short_version.bullets.length > 0) && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            The short version
          </h2>
          {report.short_version.lead && (
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              {report.short_version.lead}
            </p>
          )}
          {report.short_version.bullets.length > 0 && (
            <ul className="space-y-1">
              {report.short_version.bullets.map((b, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex gap-1.5">
                  <span className="text-sky-500 shrink-0">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Chapters — all registered builders emit the same chapter shape */}
      {report.chapters.map((chapter) => (
        <ReportChapter key={chapter.chapter_id} chapter={chapter} />
      ))}

      {/* Locked chapters — teaser cards; the upsell surface (§5.1a). At v1
          every locked CTA resolves to the claim path (paid unlock is
          post-claim — G-7; unlock plumbing lands with the paid tier). */}
      {report.locked_chapters.length > 0 && (
        <section className="space-y-2">
          {report.locked_chapters.map((locked) => (
            <div
              key={locked.chapter_id}
              className="rounded-lg border border-dashed border-gray-300 dark:border-neutral-600 bg-gray-50/60 dark:bg-neutral-800/40 p-4 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {locked.teaser}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Part of the full assessment — unlock to read this chapter.
                  </p>
                </div>
              </div>
              {report.cta.url && (
                <a
                  href={report.cta.url}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-md shrink-0"
                >
                  {report.cta.kind === 'claim' ? 'Claim to unlock' : 'Unlock'}
                </a>
              )}
            </div>
          ))}
        </section>
      )}

      {/* How this report was made — the honesty footer (§6.5) */}
      {(report.data_quality.verified.length > 0 ||
        report.data_quality.couldnt_check.length > 0 ||
        report.data_quality.limitations.length > 0) && (
        <section className="rounded-lg border border-gray-200 dark:border-neutral-700 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            How this report was made
          </p>
          {report.data_quality.verified.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                What we verified
              </p>
              <ul className="space-y-1">
                {report.data_quality.verified.map((line, i) => (
                  <li key={i} className="text-[11px] text-gray-600 dark:text-gray-400 flex gap-1.5">
                    <span className="text-emerald-500 shrink-0">✓</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.data_quality.couldnt_check.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                What we couldn't check
              </p>
              <ul className="space-y-1">
                {report.data_quality.couldnt_check.map((line, i) => (
                  <li key={i} className="text-[11px] text-gray-600 dark:text-gray-400 flex gap-1.5">
                    <span className="text-gray-400 shrink-0">–</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.data_quality.limitations.length > 0 && (
            <div>
              {report.data_quality.limitations.map((line, i) => (
                <p key={i} className="text-[11px] italic text-gray-500 dark:text-gray-500">
                  {line}
                </p>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Footer CTA (§6.6) */}
      <footer className="border-t border-gray-200 dark:border-neutral-700 pt-4">
        {report.cta.url ? (
          <a
            href={report.cta.url}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-sm"
          >
            {report.cta.label}
          </a>
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300">{report.cta.label}</p>
        )}
      </footer>
    </div>
  );
}
