/**
 * interactive-verification-directive.ts — shared run-mode preamble for
 * Interactive Verification (AUDIT_PLATFORM_AVAILABILITY_CONTROL_SPEC §12).
 *
 * The operator opts in per render by supplying a truthy `interactive_verification`
 * variable (the Prompt Workspace "Interactive verification" toggle, or any
 * caller). When enabled, this preamble is prefixed onto the rendered prompt —
 * ahead of the body's role framing — putting the external analyst on notice
 * that an operator is attending the run and can act as a second render client
 * for platforms that block the analyst (login walls, bot defense → verdicts
 * that would otherwise collapse to "unable_to_verify").
 *
 * The signal is universal: it applies to every audit and scan. The variable is
 * caller-supplied ONLY — it is never declared in a template body, so
 * renderTemplate's out-of-scope check never sees it, no SCOPE_VARIABLES
 * whitelist entries are needed, and the "off" path is byte-identical to a run
 * without the feature. Blank / 'off' / 'false' / '0' / 'no' = disabled.
 *
 * Composed ONCE at the render seam (MarketingExecutionService.resolvePrompt) —
 * never copy the text into template bodies or seed transforms (the
 * report-directives.ts contract). Bump INTERACTIVE_VERIFICATION_DIRECTIVE_VERSION
 * when the directive text changes so execution logs can identify which
 * directive version produced a run.
 */
export const INTERACTIVE_VERIFICATION_DIRECTIVE_VERSION = 'interactive_verification_v1';

/**
 * Mode header — notice of capability, not a mandate to pause. Kept short and
 * mode-like: it precedes the body's role framing, so it must not restate the
 * task or the output contract. The emit-when bounds are hard MUSTs; whether to
 * invoke the capability is the analyst's judgment.
 */
export const INTERACTIVE_VERIFICATION_DIRECTIVE = `=== INTERACTIVE VERIFICATION — OPERATOR PRESENT ===

An operator is attending this run and can act as a second render client.
If a platform blocks you — login wall, bot defense, or any access barrier
that would leave a verdict "unable to verify" — and the answer would change
a finding, determination, or selection, you may pause and ask the operator
to look before you continue.

WHEN TO ASK — only when the answer flips an outcome: the platform is in
scope, you cannot render it yourself, and an observation would change a
determination, a signal, a score component, or an exemplar/control
selection. Batch related asks into ONE pause per run where possible; each
further pause is a new budgeted event (six-attempt budget total). Never ask
about a platform whose answer could not change the output.

WHAT TO ASK — one exact URL and the exact observable fields you need
(profile exists or not, rating, review count, claimed status, hours
present, primary category, displayed name/address/phone), plus what a
negative answer looks like. Observables only — never "summarize the page"
and never a judgment call.

PERMITTED REQUEST — "open this URL in your own browser, as yourself, and
paste back the listed fields." Never ask the operator to defeat a bot wall,
solve a CAPTCHA, or use credentials they do not own.

VISIBILITY CONDITION — a positive observation must record the condition it
was seen under: public_logged_out, authenticated, or unknown. An
authenticated-only view is not public render evidence — a profile visible
only while logged in resolves to a login wall, not a business absence.

PROVENANCE — operator observations are self-reported evidence. Record each
with attempted_by: operator, the exact URL, observed_at, the
visibility_condition, and the exact observed value. Never present an
operator observation as analyst-verified. Where the output contract
provides a limitations / data-quality field, note every determination that
rests on one.

RECORDING — on business audits, record the attempt in render_controls[]
with determination business_specific_failure | platform_available |
unable_to_verify, plus attempted_by, visibility_condition, observed_at, and
observation_notes. On tasks without render_controls, record the same
provenance fields under the task's evidence or unresolved_questions output.

DECLINE / TIMEOUT — if the operator does not answer, record the attempt as
not_attempted and resolve the verdict exactly as you would without this
capability. A pause may never make the output worse than a solo run.

After the pause, proceed normally and produce the required output unchanged.
=== END INTERACTIVE VERIFICATION ===`;

/** Values that explicitly mean "off" (compared case-insensitively, trimmed). */
const DISABLED_VALUES = new Set(['', 'off', 'false', '0', 'no', 'none', 'disabled']);

/**
 * The seam gate. `interactive_verification` is caller-supplied only — any
 * non-empty, non-disabled value enables the preamble.
 */
export function isInteractiveVerificationEnabled(variables?: Record<string, any> | null): boolean {
  const raw = variables?.interactive_verification;
  if (raw === undefined || raw === null) return false;
  return !DISABLED_VALUES.has(String(raw).trim().toLowerCase());
}

/**
 * Build the run-mode preamble to prefix onto a rendered prompt. Returns ''
 * when disabled so `preamble + rendered` stays byte-identical to the solo path.
 *
 * When `operator_observations` is also supplied (the re-render path, §12.5),
 * it is carried inside the preamble so the analyst can record it with
 * operator provenance.
 */
export function buildInteractiveVerificationPreamble(variables?: Record<string, any> | null): string {
  if (!isInteractiveVerificationEnabled(variables)) return '';
  const observations = String(variables?.operator_observations ?? '').trim();
  const observationsBlock = observations
    ? `\n\n=== OPERATOR OBSERVATIONS SUPPLIED FOR THIS RUN ===\n${observations}\n=== END OPERATOR OBSERVATIONS ===\n\nTreat the supplied observations as self-reported operator evidence (attempted_by: operator) — apply the provenance and visibility-condition rules above.`
    : '';
  return INTERACTIVE_VERIFICATION_DIRECTIVE + observationsBlock + '\n\n';
}
