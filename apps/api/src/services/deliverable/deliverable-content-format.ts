/**
 * Deliverable fulfill-output formatter — converts the raw_json fulfill
 * executions' JSON into plain-text document copy for the PDF body.
 *
 * The fulfill templates (mpt-seed-fulfill-*) emit structured JSON — that
 * output is data (it feeds future consumers like a mock-draft build), so it
 * stays untouched on the execution row. Rendering verbatim would print the
 * raw JSON into the customer-facing PDF (the W6b defect the citation
 * package composer already special-cases). This module is the presentational
 * bridge: parse the JSON, render it as labeled sections/bullets, and pass
 * through anything that isn't a JSON object unchanged.
 *
 * Per-type variation lives in TYPE_LABELS — each type's `Output JSON:`
 * contract gets display labels for its top-level keys. Unknown keys fall
 * back to humanized labels and unknown shapes to the generic renderer, so
 * analyst output can never render as a raw JSON blob or silently drop keys.
 *
 * Emits plain text only — renderLayoutSections prints the body verbatim, so
 * markdown syntax (##, **) would show literally in the PDF.
 */

import type { DeliverableType } from '../MarketingDeliverableService';

// ─── Per-type top-level key labels ───────────────────────────────────────

const TYPE_LABELS: Partial<Record<DeliverableType, Record<string, string>>> = {
  website_build_package: {
    site_map: 'Site Map & Page Spec',
    nav_and_cta: 'Navigation & CTA',
    domain_hosting: 'Domain & Hosting',
    asset_requirements: 'Asset Requirements',
    platform_notes: 'Platform Implementation Notes',
    launch_checklist: 'QA & Launch Checklist',
    profile_cutover: 'Profile Cutover',
  },
  website_mockup: {
    sections: 'Homepage Mockup',
    must_have_pages: 'Must-Have Pages',
  },
  service_menu: {
    tagline: 'Tagline',
    services: 'Services',
    cta: 'Call to Action',
    why_visit: 'Why Visit',
  },
  gbp_audit: {
    description: 'Optimized Business Description',
    categories: 'Categories',
    service_area: 'Service Area',
    posts: 'Suggested GBP Posts',
    attributes: 'Attributes to Enable',
    qa: 'Q&A',
    photo_recommendations: 'Photo Recommendations',
    hours_sync: 'Hours Sync Checklist',
    fulfillment_attributes: 'Fulfillment Attributes',
  },
  testimonial_cards: { cards: 'Cards' },
  nap_report: {
    canonical: 'Canonical Record',
    platform_rows: 'Platform Status',
    corrections: 'Corrections (Priority Order)',
  },
  seo_content: { pages: 'Service Pages' },
  lead_magnet: {
    title: 'Title',
    promise: 'Promise',
    sections: 'Sections',
    cta: 'Call to Action',
  },
  product_visibility_preview: { sections: 'Sections' },
};

// Sub-key labels shared across types — also the top-level fallback before
// humanizing. Anything not listed humanizes (snake_case → Title case).
const COMMON_LABELS: Record<string, string> = {
  purpose: 'Purpose',
  key_content: 'Key content',
  nav_order: 'Nav order',
  primary_cta: 'Primary CTA',
  cta_placements: 'CTA placements',
  domain_recommendation: 'Recommended domain',
  ownership_state: 'Ownership',
  platform_recommendation: 'Recommended platform',
  question: 'Q',
  answer: 'A',
  quote: 'Quote',
  attribution: 'Attribution',
  tagline: 'Tagline',
  price: 'Price',
  status: 'Status',
  correction: 'Correction',
  h1: 'H1',
  meta_title: 'Meta title',
  meta_description: 'Meta description',
  internal_links: 'Internal links',
  content: 'Content',
};

// Fields that can title an object inside an array, in preference order.
const TITLE_KEYS = [
  'page', 'title', 'name', 'service', 'platform', 'question', 'quote',
  'theme', 'post', 'section', 'item', 'cta',
];

// ─── Public entry point ──────────────────────────────────────────────────

/**
 * Format a fulfill execution's output for the PDF body. Returns the input
 * unchanged when it isn't a JSON object — operator-prose fulfill outputs
 * and non-JSON fallbacks pass through byte-identical.
 */
export function formatFulfillContent(deliverableType: string, raw: string): string {
  if (!raw || !raw.trim()) return raw;

  const { json, trailing } = extractJsonObject(raw.trim());
  if (!json) return raw;

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return raw;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw;

  const labels = TYPE_LABELS[deliverableType as DeliverableType] ?? {};
  const sections: string[] = [];
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    // claim_cta is platform-rendered — the caller appends the resolved CTA to
    // the content, so an analyst-echoed field is dropped to avoid a double
    // CTA on executions produced while the prompt contract carried it.
    if (key === 'claim_cta') continue;
    if (value === null || value === undefined || value === '') continue;
    const lines: string[] = [];
    renderField(lines, labels[key] ?? COMMON_LABELS[key] ?? humanizeKey(key), value, 0);
    if (lines.length > 0) sections.push(lines.join('\n'));
  }

  const body = sections.join('\n\n').trimEnd();
  const tail = trailing.trim();
  return tail ? `${body}\n\n${tail}` : body;
}

// ─── Renderer ────────────────────────────────────────────────────────────

function renderField(lines: string[], label: string, value: unknown, depth: number): void {
  const ind = '  '.repeat(depth);

  if (value === null || value === undefined || value === '') return;

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    lines.push(`${ind}${label}: ${value}`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return;
    if (value.every((v) => isScalar(v))) {
      // Short scalar lists read better inline; long ones as bullets.
      const inline = value.map(String).join(' · ');
      if (inline.length <= 80) {
        lines.push(`${ind}${label}: ${inline}`);
      } else {
        lines.push(`${ind}${label}:`);
        for (const v of value) lines.push(`${ind}  • ${v}`);
      }
      return;
    }
    // Array of objects — titled blocks, numbered (order matters for site
    // maps / checklists / cards).
    lines.push(`${ind}${label}:`);
    value.forEach((item, i) => renderObjectItem(lines, item, depth + 1, i + 1));
    return;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, v]) => v !== null && v !== undefined && v !== '',
    );
    if (entries.length === 0) return;
    lines.push(`${ind}${label}:`);
    for (const [k, v] of entries) {
      renderField(lines, COMMON_LABELS[k] ?? humanizeKey(k), v, depth + 1);
    }
    return;
  }
}

function renderObjectItem(lines: string[], item: unknown, depth: number, index: number): void {
  const ind = '  '.repeat(depth);
  if (isScalar(item)) {
    lines.push(`${ind}${index}. ${item}`);
    return;
  }
  if (Array.isArray(item)) {
    lines.push(`${ind}${index}. ${item.map(String).join(' · ')}`);
    return;
  }
  if (!item || typeof item !== 'object') return;

  const obj = item as Record<string, unknown>;
  const titleKey =
    TITLE_KEYS.find((k) => typeof obj[k] === 'string' && (obj[k] as string).trim()) ??
    Object.keys(obj).find((k) => typeof obj[k] === 'string' && (obj[k] as string).trim());

  lines.push(titleKey ? `${ind}${index}. ${obj[titleKey]}` : `${ind}${index}.`);

  for (const [k, v] of Object.entries(obj)) {
    if (k === titleKey || v === null || v === undefined || v === '') continue;
    renderField(lines, COMMON_LABELS[k] ?? humanizeKey(k), v, depth + 1);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function isScalar(v: unknown): v is string | number | boolean {
  return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

function humanizeKey(key: string): string {
  const s = key.replace(/[_-]+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : key;
}

/**
 * Strip code fences and pull the first balanced {...} object out of the
 * output. Anything after the closing brace (e.g. a claim CTA the analyst
 * appended after the JSON) is returned as `trailing` so it isn't dropped.
 */
function extractJsonObject(raw: string): { json: string | null; trailing: string } {
  let s = raw;
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '');
  }
  const start = s.indexOf('{');
  if (start < 0) return { json: null, trailing: '' };

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escaped) { escaped = false; continue; }
    if (c === '\\' && inString) { escaped = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        return { json: s.slice(start, i + 1), trailing: s.slice(i + 1).replace(/```\s*$/, '') };
      }
    }
  }
  return { json: null, trailing: '' };
}
