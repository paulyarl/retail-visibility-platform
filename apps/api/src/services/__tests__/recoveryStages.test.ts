import { describe, it, expect } from 'vitest';
import {
  RECOVERY_STAGES,
  recoveryStageSchema,
  isRecoveryStage,
  RECOVERY_STAGE_LABELS,
} from '../recoveryStages';

describe('recoveryStages', () => {
  describe('RECOVERY_STAGES', () => {
    it('contains exactly the 9 spec stages', () => {
      expect(RECOVERY_STAGES).toHaveLength(9);
      expect(RECOVERY_STAGES).toEqual([
        'audit_identified',
        'framework_preview_generated',
        'outreach_dispatched',
        'awaiting_owner_intake',
        'intake_submitted',
        'final_resolution_drafted',
        'owner_approved',
        'resolved_and_closed',
        'dead',
      ]);
    });
  });

  describe('recoveryStageSchema', () => {
    it('accepts every valid recovery stage', () => {
      for (const stage of RECOVERY_STAGES) {
        expect(recoveryStageSchema.safeParse(stage).success).toBe(true);
      }
    });

    it('rejects review-track stages', () => {
      const reviewStages = ['seek', 'preview_built', 'shown', 'paid', 'delivered'];
      for (const stage of reviewStages) {
        expect(recoveryStageSchema.safeParse(stage).success).toBe(false);
      }
    });

    it('rejects arbitrary strings', () => {
      expect(recoveryStageSchema.safeParse('foo').success).toBe(false);
      expect(recoveryStageSchema.safeParse('').success).toBe(false);
    });
  });

  describe('isRecoveryStage', () => {
    it('returns true for valid recovery stages', () => {
      expect(isRecoveryStage('audit_identified')).toBe(true);
      expect(isRecoveryStage('resolved_and_closed')).toBe(true);
      expect(isRecoveryStage('dead')).toBe(true);
    });

    it('returns false for review stages and arbitrary strings', () => {
      expect(isRecoveryStage('seek')).toBe(false);
      expect(isRecoveryStage('paid')).toBe(false);
      expect(isRecoveryStage('nonsense')).toBe(false);
    });
  });

  describe('RECOVERY_STAGE_LABELS', () => {
    it('has a human-readable label for every stage', () => {
      for (const stage of RECOVERY_STAGES) {
        const label = RECOVERY_STAGE_LABELS[stage];
        expect(label).toBeTruthy();
        expect(typeof label).toBe('string');
      }
    });
  });
});
