import { BigFiveScoringService } from '../../src/assessment/uc3-personality/big-five-scoring.service';

describe('BigFiveScoringService (pure methods)', () => {
  let service: BigFiveScoringService;

  beforeEach(() => {
    service = new (BigFiveScoringService as any)(
      { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), upsert: jest.fn() },
      { find: jest.fn() },
      { findOne: jest.fn() },
      { find: jest.fn() },
    );
  });

  // ── calculateRawScore ──────────────────────────────────────────────

  describe('calculateRawScore', () => {
    it('sums regular items without adjustment', () => {
      const responses = [
        { value: 3, isReverse: false },
        { value: 4, isReverse: false },
        { value: 5, isReverse: false },
      ];
      expect(service.calculateRawScore(responses)).toBe(12);
    });

    it('applies reverse scoring: reversed value = 6 - original', () => {
      const responses = [
        { value: 1, isReverse: true },  // becomes 5
        { value: 5, isReverse: true },  // becomes 1
        { value: 3, isReverse: true },  // becomes 3
      ];
      expect(service.calculateRawScore(responses)).toBe(9); // 5+1+3
    });

    it('handles mixed regular and reversed items', () => {
      const responses = [
        { value: 4, isReverse: false }, // 4
        { value: 2, isReverse: true },  // 4
        { value: 5, isReverse: false }, // 5
        { value: 1, isReverse: true },  // 5
      ];
      expect(service.calculateRawScore(responses)).toBe(18); // 4+4+5+5
    });

    it('returns 0 for empty responses', () => {
      expect(service.calculateRawScore([])).toBe(0);
    });
  });

  // ── toTScore ───────────────────────────────────────────────────────

  describe('toTScore', () => {
    it('returns 50 when raw equals the mean', () => {
      expect(service.toTScore(30, { mean: 30, stdDev: 5 })).toBe(50);
    });

    it('returns 60 when raw is 1 SD above mean', () => {
      // 50 + 10 * ((35 - 30) / 5) = 60
      expect(service.toTScore(35, { mean: 30, stdDev: 5 })).toBe(60);
    });

    it('returns 40 when raw is 1 SD below mean', () => {
      // 50 + 10 * ((25 - 30) / 5) = 40
      expect(service.toTScore(25, { mean: 30, stdDev: 5 })).toBe(40);
    });

    it('clamps at maximum of 80', () => {
      expect(service.toTScore(100, { mean: 30, stdDev: 5 })).toBe(80);
    });

    it('clamps at minimum of 20', () => {
      expect(service.toTScore(0, { mean: 30, stdDev: 5 })).toBe(20);
    });

    it('returns 50 when stdDev is 0 to avoid division by zero', () => {
      expect(service.toTScore(35, { mean: 30, stdDev: 0 })).toBe(50);
    });
  });

  // ── toPercentile ───────────────────────────────────────────────────

  describe('toPercentile', () => {
    it('returns ~50th percentile for T-score of 50', () => {
      const p = service.toPercentile(50);
      expect(p).toBeCloseTo(50, 0);
    });

    it('returns higher percentile for T-score above 50', () => {
      expect(service.toPercentile(60)).toBeGreaterThan(50);
    });

    it('returns lower percentile for T-score below 50', () => {
      expect(service.toPercentile(40)).toBeLessThan(50);
    });

    it('returns ~84th percentile for T-score of 60 (1 SD above mean)', () => {
      const p = service.toPercentile(60);
      expect(p).toBeGreaterThan(80);
      expect(p).toBeLessThan(90);
    });

    it('returns ~16th percentile for T-score of 40 (1 SD below mean)', () => {
      const p = service.toPercentile(40);
      expect(p).toBeGreaterThan(10);
      expect(p).toBeLessThan(25);
    });

    it('never returns outside [0, 100]', () => {
      [20, 30, 40, 50, 60, 70, 80].forEach((t) => {
        const p = service.toPercentile(t);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(100);
      });
    });
  });

  // ── getFactorNarrative ─────────────────────────────────────────────

  describe('getFactorNarrative', () => {
    it('returns high narrative for T-score >= 60', () => {
      const narrative = service.getFactorNarrative('openness', 65);
      expect(narrative).toContain('high');
    });

    it('returns low narrative for T-score <= 40', () => {
      const narrative = service.getFactorNarrative('conscientiousness', 35);
      expect(narrative.length).toBeGreaterThan(20);
    });

    it('returns medium narrative for T-score between 41 and 59', () => {
      const narrative = service.getFactorNarrative('extraversion', 50);
      expect(narrative).toBeTruthy();
      expect(narrative.length).toBeGreaterThan(10);
    });

    it('returns a string for all five factors', () => {
      const factors = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'emotional_stability'];
      factors.forEach((f) => {
        expect(typeof service.getFactorNarrative(f, 50)).toBe('string');
        expect(service.getFactorNarrative(f, 50).length).toBeGreaterThan(0);
      });
    });

    it('returns a fallback string for unknown factor', () => {
      const result = service.getFactorNarrative('unknown_factor', 50);
      expect(typeof result).toBe('string');
    });
  });

  // ── end-to-end score pipeline (unit, no DB) ────────────────────────

  describe('score pipeline integration', () => {
    it('correctly scores a full 12-item factor with mixed reverse items', () => {
      // Simulate 12 conscientiousness items: 6 regular, 6 reversed
      // All regular rated 4, all reversed rated 2 (→ 6-2=4)
      const responses = [
        ...Array(6).fill({ value: 4, isReverse: false }),
        ...Array(6).fill({ value: 2, isReverse: true }),
      ];
      const raw = service.calculateRawScore(responses);
      expect(raw).toBe(48); // 6*4 + 6*4

      const norm = { mean: 40, stdDev: 8 };
      const tScore = service.toTScore(raw, norm);
      // T = 50 + 10 * ((48 - 40) / 8) = 50 + 10 = 60
      expect(tScore).toBe(60);

      const percentile = service.toPercentile(tScore);
      expect(percentile).toBeGreaterThan(80);
    });
  });
});
