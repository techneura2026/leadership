/**
 * Competency block for the HRIS export (pure — no Nest, no DB). Competency levels are 1–4.
 * `achievementVsRequiredPct` is deliberately uncapped: the HRIS applies its own cap.
 */

export interface RatingDetail {
  competencyId: string;
  competencyName: string;
  domainName: string;
  selfLevel: number | null;
  managerLevel: number | null;
  managerEvidence: string | null;
  developmentComment: string | null;
}

export interface ExportRoleProfile {
  id: string;
  title: string;
  requiredCompetencies: Array<{ competencyId: string; minLevel: number; weight: number }>;
}

export interface CompetencyItem {
  competencyRef: string;
  name: string;
  domain: string;
  selfLevel: number | null;
  managerLevel: number | null;
  requiredLevel: number | null;
  weightInRole: number | null;
  gapSelfVsManager: number | null;
  gapVsRequired: number | null;
  managerEvidence: string | null;
  developmentComment: string | null;
}

export interface CompetencyBlock {
  scaleMax: 4;
  roleProfile: { ref: string; title: string } | null;
  items: CompetencyItem[];
  summary: { managerAvgPct: number | null; achievementVsRequiredPct: number | null };
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function buildCompetencyBlock(ratings: RatingDetail[], roleProfile: ExportRoleProfile | null): CompetencyBlock {
  const required = new Map((roleProfile?.requiredCompetencies ?? []).map((r) => [r.competencyId, r]));

  const items: CompetencyItem[] = ratings.map((r) => {
    const req = required.get(r.competencyId);
    return {
      competencyRef: r.competencyId,
      name: r.competencyName,
      domain: r.domainName,
      selfLevel: r.selfLevel,
      managerLevel: r.managerLevel,
      requiredLevel: req?.minLevel ?? null,
      weightInRole: req?.weight ?? null,
      gapSelfVsManager: r.managerLevel !== null && r.selfLevel !== null ? r.managerLevel - r.selfLevel : null,
      gapVsRequired: r.managerLevel !== null && req ? r.managerLevel - req.minLevel : null,
      managerEvidence: r.managerEvidence,
      developmentComment: r.developmentComment,
    };
  });

  const rated = items.filter((i) => i.managerLevel !== null);
  const managerAvgPct = rated.length
    ? round1((rated.reduce((s, i) => s + (i.managerLevel as number), 0) / rated.length / 4) * 100)
    : null;

  const weighted = rated.filter((i) => i.requiredLevel && i.weightInRole);
  const totalWeight = weighted.reduce((s, i) => s + (i.weightInRole as number), 0);
  const achievementVsRequiredPct = totalWeight > 0
    ? round1(
        weighted.reduce((s, i) => s + (i.weightInRole as number) * ((i.managerLevel as number) / (i.requiredLevel as number)) * 100, 0) /
          totalWeight,
      )
    : null;

  return {
    scaleMax: 4,
    roleProfile: roleProfile ? { ref: roleProfile.id, title: roleProfile.title } : null,
    items,
    summary: { managerAvgPct, achievementVsRequiredPct },
  };
}
