/**
 * Tests the 360 anonymity threshold logic.
 * The rule: results are only shown when >= 3 raters per perspective group
 * have completed (except supervisor, which is typically 1).
 */

const MIN_RATERS = 3;

interface Nomination {
  relationship: string;
  status: string;
}

function checkAnonymityThresholds(nominations: Nomination[]): {
  canReveal: boolean;
  issues: string[];
} {
  const completed = nominations.filter((n) => n.status === 'completed');

  const groups: Record<string, number> = {};
  for (const n of completed) {
    groups[n.relationship] = (groups[n.relationship] ?? 0) + 1;
  }

  const issues: string[] = [];
  const groupsToCheck = ['peer', 'direct_report', 'stakeholder'];

  for (const rel of groupsToCheck) {
    const count = groups[rel] ?? 0;
    const nominated = nominations.filter((n) => n.relationship === rel).length;
    if (nominated > 0 && count < MIN_RATERS) {
      issues.push(`Insufficient ${rel} responses (${count}/${MIN_RATERS})`);
    }
  }

  return { canReveal: issues.length === 0, issues };
}

describe('360 Anonymity Threshold Logic', () => {
  describe('sufficient responses', () => {
    it('allows reveal when all groups have >= 3 completed', () => {
      const nominations: Nomination[] = [
        { relationship: 'supervisor', status: 'completed' },
        ...Array(3).fill({ relationship: 'peer', status: 'completed' }),
        ...Array(3).fill({ relationship: 'direct_report', status: 'completed' }),
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('allows reveal with more than minimum raters', () => {
      const nominations: Nomination[] = [
        { relationship: 'supervisor', status: 'completed' },
        ...Array(5).fill({ relationship: 'peer', status: 'completed' }),
        ...Array(4).fill({ relationship: 'direct_report', status: 'completed' }),
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(true);
    });

    it('allows reveal when supervisor alone (no other groups nominated)', () => {
      const nominations: Nomination[] = [
        { relationship: 'supervisor', status: 'completed' },
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(true);
    });
  });

  describe('insufficient responses', () => {
    it('blocks reveal when peer group has < 3 completed', () => {
      const nominations: Nomination[] = [
        { relationship: 'supervisor', status: 'completed' },
        { relationship: 'peer', status: 'completed' },
        { relationship: 'peer', status: 'completed' },
        { relationship: 'peer', status: 'pending' },  // not completed
        ...Array(3).fill({ relationship: 'direct_report', status: 'completed' }),
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]).toContain('peer');
    });

    it('blocks reveal when direct_report group has < 3 completed', () => {
      const nominations: Nomination[] = [
        { relationship: 'supervisor', status: 'completed' },
        ...Array(4).fill({ relationship: 'peer', status: 'completed' }),
        { relationship: 'direct_report', status: 'completed' },
        { relationship: 'direct_report', status: 'completed' },
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(false);
      expect(result.issues.some((i) => i.includes('direct_report'))).toBe(true);
    });

    it('reports all violated groups, not just the first', () => {
      const nominations: Nomination[] = [
        { relationship: 'peer', status: 'completed' },          // only 1 peer
        { relationship: 'direct_report', status: 'completed' }, // only 1 dr
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(false);
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
    });

    it('blocks reveal when zero responses from a nominated group', () => {
      const nominations: Nomination[] = [
        { relationship: 'peer', status: 'pending' },
        { relationship: 'peer', status: 'pending' },
        { relationship: 'peer', status: 'pending' },
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(false);
    });
  });

  describe('supervisor group', () => {
    it('does not require 3 supervisor responses (1 is sufficient)', () => {
      const nominations: Nomination[] = [
        { relationship: 'supervisor', status: 'completed' },
        ...Array(3).fill({ relationship: 'peer', status: 'completed' }),
        ...Array(3).fill({ relationship: 'direct_report', status: 'completed' }),
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(true);
    });
  });

  describe('pending vs completed distinction', () => {
    it('counts only completed nominations, not pending ones', () => {
      const nominations: Nomination[] = [
        // 3 peer nominated, but only 2 completed
        { relationship: 'peer', status: 'completed' },
        { relationship: 'peer', status: 'completed' },
        { relationship: 'peer', status: 'pending' },
        ...Array(3).fill({ relationship: 'direct_report', status: 'completed' }),
      ];
      const result = checkAnonymityThresholds(nominations);
      expect(result.canReveal).toBe(false);
      expect(result.issues[0]).toContain('2/3');
    });
  });
});
