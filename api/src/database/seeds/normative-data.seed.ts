import { DataSource } from 'typeorm';
import { NormativeDatum } from '../../assessment/uc3-personality/entities/normative-datum.entity';

// Normative data for Sri Lanka general working population
// Based on adapted Big Five norms for South/Southeast Asian professional samples
// T-score: 50 = population mean, SD = 10
// Percentile table maps T-score (20-80) to percentile
const buildPercentileTable = (): Record<number, number> => {
  const table: Record<number, number> = {};
  // Standard normal CDF approximation for T-scores
  for (let t = 20; t <= 80; t++) {
    const z = (t - 50) / 10;
    const percentile = normalCDF(z) * 100;
    table[t] = Math.round(percentile * 10) / 10;
  }
  return table;
};

// Abramowitz & Stegun approximation of normal CDF
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob =
    d *
    t *
    (0.3193815 +
      t * (-0.3565638 + t * (1.7814779 + t * (-1.8212559 + t * 1.3302744))));
  return z > 0 ? 1 - prob : prob;
}

const NORMATIVE_DATA = [
  {
    factor: 'openness',
    population: 'sri_lanka_general',
    sampleSize: 200,
    mean: 42.5,  // Raw score out of 60 (12 items × 5 max)
    stdDev: 8.2,
  },
  {
    factor: 'conscientiousness',
    population: 'sri_lanka_general',
    sampleSize: 200,
    mean: 45.8,
    stdDev: 7.6,
  },
  {
    factor: 'extraversion',
    population: 'sri_lanka_general',
    sampleSize: 200,
    mean: 38.4,
    stdDev: 9.1,
  },
  {
    factor: 'agreeableness',
    population: 'sri_lanka_general',
    sampleSize: 200,
    mean: 44.2,
    stdDev: 7.9,
  },
  {
    factor: 'emotional_stability',
    population: 'sri_lanka_general',
    sampleSize: 200,
    mean: 40.1,
    stdDev: 8.7,
  },
];

export async function seedNormativeData(dataSource: DataSource): Promise<void> {
  const repo = dataSource.getRepository(NormativeDatum);
  const percentileTable = buildPercentileTable();

  for (const normData of NORMATIVE_DATA) {
    const existing = await repo.findOne({
      where: { factor: normData.factor, population: normData.population },
    });
    if (existing) {
      continue;
    }

    const norm = repo.create({
      factor: normData.factor,
      population: normData.population,
      sampleSize: normData.sampleSize,
      mean: normData.mean,
      stdDev: normData.stdDev,
      percentileTable,
    });

    await repo.save(norm);
  }
}
