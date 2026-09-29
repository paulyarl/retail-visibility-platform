/**
 * operator-profile-evidence-directive.ts — shared run-mode preamble for
 * operator-supplied directory profile evidence (companion to
 * interactive-verification-directive.ts).
 *
 * The operator knows the prospect's directory profiles (Google, Yelp,
 * Facebook) before requesting the audit. Instead of letting the analyst
 * hunt them live — where login walls and bot defense collapse verdicts to
 * "unable_to_verify" — the operator saves page copies (profile fields and
 * review text) into a local file on the analyst's workstation and supplies
 * its path via the `operator_profile_evidence_file` variable (the Prompt
 * Workspace "Directory profile evidence" field, or any caller). When set,
 * this block is prefixed onto the rendered prompt directing the analyst to
 * read the file as the primary evidence source for the profiles it covers.
 *
 * The signal is universal and independent of `interactive_verification` —
 * the file is useful whether or not an operator attends the run. The
 * variable is caller-supplied ONLY — it is never declared in a template
 * body, so renderTemplate's out-of-scope check never sees it, no
 * SCOPE_VARIABLES whitelist entries are needed, and the "off" path is
 * byte-identical to a run without the feature.
 *
 * Composed ONCE at the render seam (MarketingExecutionService.resolvePrompt)
 * — never copy the text into template bodies or seed transforms. Bump
 * OPERATOR_PROFILE_EVIDENCE_DIRECTIVE_VERSION when the directive text
 * changes so execution logs can identify which version produced a run.
 */
export const OPERATOR_PROFILE_EVIDENCE_DIRECTIVE_VERSION = 'operator_profile_evidence_v1';

/** Caller-supplied variable carrying the workstation path of the evidence file. */
export const OPERATOR_PROFILE_EVIDENCE_VARIABLE = 'operator_profile_evidence_file';

/**
 * Build the evidence block for a supplied file path. Read-first framing:
 * the file is the intended primary source for the profiles it covers, so
 * the analyst reads it before rendering those platforms itself. Provenance
 * mirrors interactive-verification — the contents are operator-supplied,
 * never analyst-verified.
 */
export function buildOperatorProfileEvidenceBlock(filePath: string): string {
  return `=== OPERATOR-SUPPLIED DIRECTORY PROFILE EVIDENCE ===

The operator has prepared a local evidence file on this machine containing
copies of this prospect's directory profile pages (e.g. Google Business
Profile, Yelp, Facebook) captured ahead of this run — profile fields and,
where present, review text.

FILE: ${filePath}

READ FIRST — if your environment can read local files, open FILE before
attempting to render these platforms yourself. It is the intended primary
evidence source for the profiles it covers: it sidesteps login walls and
bot defenses, and its review text is legitimate input for sentiment,
narrative, and reputation findings.

PROVENANCE — the file's contents are operator-supplied evidence, not
analyst-verified render. Record anything taken from it with
attempted_by: operator plus the platform and URL the section covers.
Where a section states its capture condition (public_logged_out /
authenticated) or capture date, carry it; where unstated, record
visibility_condition: unknown. An authenticated-only capture is not
public render evidence.

CONFLICTS — if your own verified live render disagrees with the file, the
live render wins; record the drift in render_controls[] or the output's
evidence / data-quality field rather than silently picking one.

FALLBACK — if the file is absent, unreadable, or your environment has no
file access, proceed exactly as you would without it. The file may
improve the audit but must never block or worsen it.
=== END OPERATOR PROFILE EVIDENCE ===`;
}

/**
 * The seam gate + builder. Returns '' when no path is supplied so
 * `preamble + rendered` stays byte-identical to a run without the feature.
 */
export function buildOperatorProfileEvidencePreamble(variables?: Record<string, any> | null): string {
  const filePath = String(variables?.[OPERATOR_PROFILE_EVIDENCE_VARIABLE] ?? '').trim();
  if (!filePath) return '';
  return buildOperatorProfileEvidenceBlock(filePath) + '\n\n';
}
