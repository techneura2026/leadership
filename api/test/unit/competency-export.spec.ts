import { buildCompetencyBlock, RatingDetail } from '../../src/integrations/hris/competency-export';

const rating = (competencyId: string, selfLevel: number | null, managerLevel: number | null): RatingDetail => ({
  competencyId,
  competencyName: `Competency ${competencyId}`,
  domainName: 'Conceptual',
  selfLevel,
  managerLevel,
  managerEvidence: managerLevel === null ? null : `evidence ${competencyId}`,
  developmentComment: null,
});

const profile = {
  id: 'rp-1',
  title: 'Engineering Manager',
  requiredCompetencies: [
    { competencyId: 'a', minLevel: 3, weight: 0.5 },
    { competencyId: 'b', minLevel: 4, weight: 0.5 },
  ],
};

describe('buildCompetencyBlock (HRIS competency export)', () => {
  it('computes self/manager/required gaps from the role profile', () => {
    const block = buildCompetencyBlock([rating('a', 3, 2), rating('c', 2, 3)], profile);
    expect(block.scaleMax).toBe(4);
    expect(block.roleProfile).toEqual({ ref: 'rp-1', title: 'Engineering Manager' });
    expect(block.items[0]).toEqual({
      competencyRef: 'a',
      name: 'Competency a',
      domain: 'Conceptual',
      selfLevel: 3,
      managerLevel: 2,
      requiredLevel: 3,
      weightInRole: 0.5,
      gapSelfVsManager: -1,
      gapVsRequired: -1,
      managerEvidence: 'evidence a',
      developmentComment: null,
    });
    expect(block.items[1]).toMatchObject({ competencyRef: 'c', requiredLevel: null, weightInRole: null, gapVsRequired: null });
  });

  it('achievementVsRequiredPct is weight-weighted and uncapped', () => {
    const block = buildCompetencyBlock([rating('a', null, 4), rating('b', null, 2)], profile);
    // a: 4/3 = 133.3%, b: 2/4 = 50% → (0.5*133.33 + 0.5*50) / 1 = 91.7
    expect(block.summary.achievementVsRequiredPct).toBe(91.7);
    // manager average (4 + 2) / 2 = 3 → 75%
    expect(block.summary.managerAvgPct).toBe(75);
  });

  it('without a role profile requiredLevel and achievementVsRequiredPct are null', () => {
    const block = buildCompetencyBlock([rating('a', 2, 3)], null);
    expect(block.roleProfile).toBeNull();
    expect(block.items[0].requiredLevel).toBeNull();
    expect(block.summary.achievementVsRequiredPct).toBeNull();
  });

  it('with no manager ratings yet managerAvgPct is null and gaps are null', () => {
    const block = buildCompetencyBlock([rating('a', 2, null)], profile);
    expect(block.summary.managerAvgPct).toBeNull();
    expect(block.summary.achievementVsRequiredPct).toBeNull();
    expect(block.items[0]).toMatchObject({ gapSelfVsManager: null, gapVsRequired: null });
  });
});
