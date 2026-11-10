import { toOthersAggregate, ExportNomination } from '../../src/integrations/hris/feedback-export';

const C = 'comp-1';
const nom = (relationship: string, score: number | null, status = 'completed', competencyId = C): ExportNomination => ({
  relationship: relationship as ExportNomination['relationship'],
  status,
  responses: [{ competencyId, score }],
});
const opts = { minPerGroup: 3, scaleMax: 5 };

describe('toOthersAggregate (HRIS 360 export)', () => {
  it('excludes self from othersMean and reports the gap against self', () => {
    const r = toOthersAggregate([nom('self', 5), nom('peer', 3), nom('peer', 3), nom('supervisor', 3)], opts);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.items).toEqual([{ competencyId: C, othersMean: 3, self: 5, gapVsSelf: -2, byGroup: {} }]);
  });

  it('drops rater groups below the threshold from byGroup but keeps their scores in othersMean', () => {
    const r = toOthersAggregate([nom('peer', 4), nom('peer', 4), nom('peer', 4), nom('supervisor', 2)], opts);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.items[0].othersMean).toBe(3.5);
    expect(r.items[0].byGroup).toEqual({ peer: { mean: 4, n: 3 } });
    expect(r.items[0].self).toBeNull();
    expect(r.items[0].gapVsSelf).toBeNull();
  });

  it('returns insufficient_raters with no numbers when fewer than the threshold of non-self raters responded', () => {
    const r = toOthersAggregate([nom('self', 4), nom('peer', 2), nom('peer', 5)], opts);
    expect(r).toEqual({ status: 'insufficient_raters', minRaterThreshold: 3 });
  });

  it('ignores nominations that are not completed', () => {
    const r = toOthersAggregate(
      [nom('peer', 4), nom('peer', 4), nom('peer', 1, 'sent'), nom('peer', 1, 'approved'), nom('direct_report', 4, 'declined')],
      opts,
    );
    expect(r).toEqual({ status: 'insufficient_raters', minRaterThreshold: 3 });
  });

  it('maps the scale so 1 → 0% and scaleMax → 100%', () => {
    const high = toOthersAggregate([nom('peer', 5), nom('peer', 5), nom('peer', 5)], opts);
    const low = toOthersAggregate([nom('peer', 1), nom('peer', 1), nom('peer', 1)], opts);
    expect(high.status === 'ok' && high.overallOthersPct).toBe(100);
    expect(low.status === 'ok' && low.overallOthersPct).toBe(0);
  });

  it('averages overallOthersPct across competencies and rounds to 1 dp', () => {
    const two = (score: number, other: number): ExportNomination => ({
      relationship: 'peer' as ExportNomination['relationship'],
      status: 'completed',
      responses: [{ competencyId: 'a', score }, { competencyId: 'b', score: other }],
    });
    const r = toOthersAggregate([two(4, 3), two(4, 3), two(4, 2)], opts);
    if (r.status !== 'ok') throw new Error('expected ok');
    // a: 4 → 75%, b: 2.67 → 41.7%; mean of othersMean (4 + 2.67)/2 = 3.33 → 58.3%
    expect(r.overallOthersPct).toBe(58.3);
    expect(r.items.find((i) => i.competencyId === 'b')!.othersMean).toBe(2.67);
  });

  it('ignores null scores without counting them', () => {
    const r = toOthersAggregate([nom('peer', 4), nom('peer', 4), nom('peer', 4), nom('peer', null)], opts);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.items[0].byGroup.peer).toEqual({ mean: 4, n: 3 });
  });

  it('carries scaleMax and threshold so the HRIS can normalise', () => {
    const r = toOthersAggregate([nom('peer', 4), nom('peer', 4), nom('peer', 4)], { minPerGroup: 3, scaleMax: 7 });
    expect(r).toMatchObject({ status: 'ok', scaleMax: 7, minRaterThreshold: 3 });
  });
});
