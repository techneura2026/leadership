/**
 * Anonymity-safe 360 aggregation for the HRIS export (pure — no Nest, no DB).
 *
 * Unlike the in-app aggregation, the self-rating is never part of `othersMean`, any rater group
 * with fewer than `minPerGroup` raters is left out of `byGroup`, and when the total number of
 * non-self raters is below the threshold no numbers are released at all. Rater identities and
 * individual answers are never part of the output.
 */

export type ExportRelationship = 'self' | 'supervisor' | 'peer' | 'direct_report' | 'stakeholder';
type OtherGroup = Exclude<ExportRelationship, 'self'>;

export interface ExportNomination {
  relationship: ExportRelationship;
  status: string;
  responses: Array<{ competencyId: string; score: number | null }>;
}

export interface Feedback360Item {
  competencyId: string;
  othersMean: number;
  self: number | null;
  gapVsSelf: number | null;
  byGroup: Partial<Record<OtherGroup, { mean: number; n: number }>>;
}

export type Feedback360Block =
  | { status: 'ok'; scaleMax: number; minRaterThreshold: number; items: Feedback360Item[]; overallOthersPct: number }
  | { status: 'insufficient_raters'; minRaterThreshold: number };

const round = (v: number, dp: number) => Math.round(v * 10 ** dp) / 10 ** dp;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function toOthersAggregate(
  nominations: ExportNomination[],
  opts: { minPerGroup: number; scaleMax: number },
): Feedback360Block {
  const completed = nominations.filter((n) => n.status === 'completed');
  const others = completed.filter((n) => n.relationship !== 'self');
  if (others.length < opts.minPerGroup) {
    return { status: 'insufficient_raters', minRaterThreshold: opts.minPerGroup };
  }

  const byCompetency = new Map<string, { all: number[]; groups: Map<OtherGroup, number[]>; self: number | null }>();
  const entry = (id: string) => {
    let e = byCompetency.get(id);
    if (!e) byCompetency.set(id, (e = { all: [], groups: new Map(), self: null }));
    return e;
  };

  for (const n of completed) {
    for (const r of n.responses) {
      if (r.score === null || r.score === undefined) continue;
      const e = entry(r.competencyId);
      const score = Number(r.score);
      if (n.relationship === 'self') {
        e.self = score;
        continue;
      }
      e.all.push(score);
      const g = n.relationship as OtherGroup;
      e.groups.set(g, [...(e.groups.get(g) ?? []), score]);
    }
  }

  const items: Feedback360Item[] = [];
  const rawMeans: number[] = [];
  for (const [competencyId, e] of byCompetency) {
    if (e.all.length === 0) continue; // only a self-rating for this competency
    const othersMean = mean(e.all);
    rawMeans.push(othersMean);
    const byGroup: Feedback360Item['byGroup'] = {};
    for (const [g, scores] of e.groups) {
      if (scores.length >= opts.minPerGroup) byGroup[g] = { mean: round(mean(scores), 2), n: scores.length };
    }
    items.push({
      competencyId,
      othersMean: round(othersMean, 2),
      self: e.self,
      gapVsSelf: e.self === null ? null : round(othersMean - e.self, 2),
      byGroup,
    });
  }

  const overall = rawMeans.length ? mean(rawMeans) : 1;
  const span = Math.max(opts.scaleMax - 1, 1);
  return {
    status: 'ok',
    scaleMax: opts.scaleMax,
    minRaterThreshold: opts.minPerGroup,
    items,
    overallOthersPct: round(((overall - 1) / span) * 100, 1),
  };
}
