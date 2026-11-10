import { effectiveGridPerformance, performanceSource } from '../../src/assessment/uc4-readiness/entities/readiness-score.entity';

const score = (gridPerformance: 'high' | 'medium' | 'low', manual: 'high' | 'medium' | 'low' | null = null) => ({
  gridPerformance,
  manualGridPerformance: manual,
});

describe('9-box performance axis', () => {
  it('a manual HR override beats the HRIS score', () => {
    expect(effectiveGridPerformance(score('low', 'medium'), { finalScore: 95 })).toBe('medium');
    expect(performanceSource(score('low', 'medium'), { finalScore: 95 })).toBe('manual');
  });

  it('the HRIS final score is banded ≥70 high, ≥40 medium, else low', () => {
    expect(effectiveGridPerformance(score('low'), { finalScore: 70 })).toBe('high');
    expect(effectiveGridPerformance(score('low'), { finalScore: 69.99 })).toBe('medium');
    expect(effectiveGridPerformance(score('high'), { finalScore: 40 })).toBe('medium');
    expect(effectiveGridPerformance(score('high'), { finalScore: 39.9 })).toBe('low');
    expect(performanceSource(score('high'), { finalScore: 39.9 })).toBe('hris');
  });

  it('without an HRIS score the 360-derived value is used, unchanged', () => {
    expect(effectiveGridPerformance(score('medium'))).toBe('medium');
    expect(effectiveGridPerformance(score('medium'), null)).toBe('medium');
    expect(performanceSource(score('medium'), null)).toBe('feedback360');
  });
});
