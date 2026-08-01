import { describe, it, expect } from 'vitest';
import { runQualityGate } from '../outreach-openers/quality-gate';

// ─── Fixtures ────────────────────────────────────────────────────────────

// A2 archetype opener that passes every gate EXCEPT the signoff line under
// test. Built from the real Bassett Services import that surfaced the bug.
const BASE_OPENER_BODY = `Hi Bassett Services team —

Pulled together a quick visibility snapshot for Bassett Services.

A cluster of 8 negative reviews all point at the same thing — arrival windows running late — and a second cluster around trip fees and pricing surprises, and they're sitting unanswered.

Three previews attached — the arrival-window review cluster, owner responses I drafted to turn each one around, and the recovery playbook.

Full deliverable's ready within a day if any of it's useful.`;

const openerWith = (signoff: string) => `${BASE_OPENER_BODY}\n\n${signoff}`;

// ─── Tests ──────────────────────────────────────────────────────────────

describe('runQualityGate — signoff', () => {
  it('accepts the literal placeholder "— [your name]"', () => {
    const result = runQualityGate(openerWith('— [your name]'));
    expect(result.issues).not.toContain(
      'Missing signoff ("— [your name]" or "— <your name>")',
    );
    expect(result.passed).toBe(true);
  });

  it('accepts a real substituted name (Path 2 import)', () => {
    // Regression: the operator replaced [your name] with "Alex" and the
    // gate penalized them for it. A real name should pass.
    const result = runQualityGate(openerWith('— Alex'));
    expect(result.issues).not.toContain(
      'Missing signoff ("— [your name]" or "— <your name>")',
    );
    expect(result.passed).toBe(true);
  });

  it('accepts a real name with no space after the em-dash', () => {
    const result = runQualityGate(openerWith('—Alex'));
    expect(result.issues).not.toContain(
      'Missing signoff ("— [your name]" or "— <your name>")',
    );
    expect(result.passed).toBe(true);
  });

  it('accepts a multi-word signoff', () => {
    const result = runQualityGate(openerWith('— Alex Morgan'));
    expect(result.issues).not.toContain(
      'Missing signoff ("— [your name]" or "— <your name>")',
    );
    expect(result.passed).toBe(true);
  });

  it('rejects a missing signoff', () => {
    const result = runQualityGate(BASE_OPENER_BODY);
    expect(result.issues).toContain(
      'Missing signoff ("— [your name]" or "— <your name>")',
    );
    expect(result.passed).toBe(false);
  });

  it('rejects an empty signoff ("— " with no name)', () => {
    const result = runQualityGate(openerWith('— '));
    expect(result.issues).toContain(
      'Missing signoff ("— [your name]" or "— <your name>")',
    );
    expect(result.passed).toBe(false);
  });
});

describe('runQualityGate — body word/stat count with real signoff', () => {
  // The body-stripping regex must remove a real name so it isn't counted
  // as a stat or word. "Alex" has no digits so it can't pollute the stat
  // count, but a name like "Lee 3rd" would. The strip must remove it.
  it('does not count the substituted name as a stat', () => {
    const result = runQualityGate(openerWith('— Alex 3rd'));
    expect(result.issues).not.toContain(
      'More than one stat in hook: 8, 3',
    );
  });
});
