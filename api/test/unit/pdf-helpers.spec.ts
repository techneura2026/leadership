import * as Handlebars from 'handlebars';
import '../../src/reporting/pdf.service'; // registers the template helpers on import

describe('PDF template helpers used by competency.hbs', () => {
  const render = (tpl: string, ctx: Record<string, unknown>) => Handlebars.compile(tpl)(ctx);

  it('times repeats its block n times', () => {
    expect(render('{{#times n}}x{{/times}}', { n: 3 })).toBe('xxx');
  });

  it('timesRemaining repeats its block (max − n) times', () => {
    expect(render('{{#timesRemaining n 4}}o{{/timesRemaining}}', { n: 1 })).toBe('ooo');
  });

  it('treats a missing rating as 0 and never repeats a negative count', () => {
    expect(render('{{#times n}}x{{/times}}', { n: null })).toBe('');
    expect(render('{{#timesRemaining n 4}}o{{/timesRemaining}}', { n: null })).toBe('oooo');
    expect(render('{{#timesRemaining n 4}}o{{/timesRemaining}}', { n: 6 })).toBe('');
  });
});
