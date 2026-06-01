import { ReadinessScoringService } from '../../src/assessment/uc4-readiness/readiness-scoring.service';
import { ReadinessRating } from '@leaderprism/shared';

// We only test the pure computation methods — DB access is mocked away
describe('ReadinessScoringService (pure methods)', () => {
  let service: ReadinessScoringService;

  const makeRepo = () => ({
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    upsert: jest.fn(),
  });

  beforeEach(() => {
    service = new (ReadinessScoringService as any)(
      makeRepo(), // sjtResponseRepo
      makeRepo(), // laResponseRepo
      makeRepo(), // readinessScoreRepo
      makeRepo(), // roleProfileRepo
      makeRepo(), // competencyRatingRepo
      makeRepo(), // caRepo
      makeRepo(), // personalityScoreRepo
      makeRepo(), // nominationRepo
      makeRepo(), // raterResponseRepo
      makeRepo(), // itemRepo
    );
  });

  // ── mapToReadinessRating ───────────────────────────────────────────

  describe('mapToReadinessRating', () => {
    it('returns READY_NOW for score >= 75', () => {
      expect(service.mapToReadinessRating(75)).toBe(ReadinessRating.READY_NOW);
      expect(service.mapToReadinessRating(90)).toBe(ReadinessRating.READY_NOW);
      expect(service.mapToReadinessRating(100)).toBe(ReadinessRating.READY_NOW);
    });

    it('returns ONE_TWO_YEARS for score 60–74', () => {
      expect(service.mapToReadinessRating(60)).toBe(ReadinessRating.ONE_TWO_YEARS);
      expect(service.mapToReadinessRating(70)).toBe(ReadinessRating.ONE_TWO_YEARS);
      expect(service.mapToReadinessRating(74)).toBe(ReadinessRating.ONE_TWO_YEARS);
    });

    it('returns DEVELOPING for score 45–59', () => {
      expect(service.mapToReadinessRating(45)).toBe(ReadinessRating.DEVELOPING);
      expect(service.mapToReadinessRating(52)).toBe(ReadinessRating.DEVELOPING);
      expect(service.mapToReadinessRating(59)).toBe(ReadinessRating.DEVELOPING);
    });

    it('returns NOT_YET_READY for score < 45', () => {
      expect(service.mapToReadinessRating(44)).toBe(ReadinessRating.NOT_YET_READY);
      expect(service.mapToReadinessRating(20)).toBe(ReadinessRating.NOT_YET_READY);
      expect(service.mapToReadinessRating(0)).toBe(ReadinessRating.NOT_YET_READY);
    });

    it('handles boundary values correctly', () => {
      expect(service.mapToReadinessRating(74.9)).toBe(ReadinessRating.ONE_TWO_YEARS);
      expect(service.mapToReadinessRating(75.0)).toBe(ReadinessRating.READY_NOW);
      expect(service.mapToReadinessRating(59.9)).toBe(ReadinessRating.DEVELOPING);
      expect(service.mapToReadinessRating(60.0)).toBe(ReadinessRating.ONE_TWO_YEARS);
      expect(service.mapToReadinessRating(44.9)).toBe(ReadinessRating.NOT_YET_READY);
      expect(service.mapToReadinessRating(45.0)).toBe(ReadinessRating.DEVELOPING);
    });
  });

  // ── getCompositeScore ──────────────────────────────────────────────

  describe('getCompositeScore', () => {
    it('calculates weighted average correctly', () => {
      const scores = {
        competencyScore: 80,   // * 0.30 = 24
        feedbackScore: 70,     // * 0.25 = 17.5
        sjtScore: 60,          // * 0.25 = 15
        learningAgilityScore: 50, // * 0.15 = 7.5
        personalityFitScore: 40,  // * 0.05 = 2
      };
      // total = 24 + 17.5 + 15 + 7.5 + 2 = 66
      expect(service.getCompositeScore(scores)).toBeCloseTo(66, 1);
    });

    it('returns 100 when all components are 100', () => {
      const scores = {
        competencyScore: 100,
        feedbackScore: 100,
        sjtScore: 100,
        learningAgilityScore: 100,
        personalityFitScore: 100,
      };
      expect(service.getCompositeScore(scores)).toBeCloseTo(100, 1);
    });

    it('returns 0 when all components are 0', () => {
      const scores = {
        competencyScore: 0,
        feedbackScore: 0,
        sjtScore: 0,
        learningAgilityScore: 0,
        personalityFitScore: 0,
      };
      expect(service.getCompositeScore(scores)).toBe(0);
    });

    it('weights sum to 1.0 (weights are internally consistent)', () => {
      // Test via a known equal-score case
      const scores = {
        competencyScore: 60,
        feedbackScore: 60,
        sjtScore: 60,
        learningAgilityScore: 60,
        personalityFitScore: 60,
      };
      // 0.30 + 0.25 + 0.25 + 0.15 + 0.05 = 1.0, so result should be 60
      expect(service.getCompositeScore(scores)).toBeCloseTo(60, 1);
    });
  });

  // ── full pipeline: composite → rating ─────────────────────────────

  describe('end-to-end readiness calculation (mocked components)', () => {
    it('classifies a strong candidate correctly', () => {
      const scores = {
        competencyScore: 85,
        feedbackScore: 80,
        sjtScore: 78,
        learningAgilityScore: 72,
        personalityFitScore: 65,
      };
      const composite = service.getCompositeScore(scores);
      const rating = service.mapToReadinessRating(composite);
      expect(composite).toBeGreaterThan(75);
      expect(rating).toBe(ReadinessRating.READY_NOW);
    });

    it('classifies a developing candidate correctly', () => {
      const scores = {
        competencyScore: 50,
        feedbackScore: 55,
        sjtScore: 45,
        learningAgilityScore: 50,
        personalityFitScore: 60,
      };
      const composite = service.getCompositeScore(scores);
      const rating = service.mapToReadinessRating(composite);
      expect(composite).toBeGreaterThan(44);
      expect(composite).toBeLessThan(60);
      expect(rating).toBe(ReadinessRating.DEVELOPING);
    });
  });
});
