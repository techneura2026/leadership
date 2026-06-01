import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { ReportType } from '@leaderprism/shared';

// Register Handlebars helpers
Handlebars.registerHelper('formatScore', (score: number | null | undefined) => {
  if (score === null || score === undefined) return '—';
  return Number(score).toFixed(2);
});

Handlebars.registerHelper('formatGap', (gap: number | null | undefined) => {
  if (gap === null || gap === undefined) return '—';
  const n = Number(gap);
  if (n > 0) return `+${n.toFixed(2)}`;
  return n.toFixed(2);
});

Handlebars.registerHelper('gapClass', (gap: number | null | undefined) => {
  if (gap === null || gap === undefined) return 'gap-zero';
  const n = Number(gap);
  if (n > 0.3) return 'gap-positive';
  if (n < -0.3) return 'gap-negative';
  return 'gap-zero';
});

Handlebars.registerHelper('barWidth', (score: number, maxScale: number) => {
  if (!score || !maxScale) return 0;
  return Math.round((Number(score) / Number(maxScale)) * 100);
});

Handlebars.registerHelper('markerPosition', function (this: any) {
  const tScore = this.tScore ?? 50;
  // Map T-score [20, 80] to [0, 100]
  return Math.round(((Number(tScore) - 20) / 60) * 100);
});

Handlebars.registerHelper('readinessBadgeClass', (rating: string) => {
  const map: Record<string, string> = {
    ready_now: 'badge-ready-now',
    '1_2_years': 'badge-1-2-years',
    developing: 'badge-developing',
    not_yet_ready: 'badge-not-yet',
  };
  return map[rating] ?? 'badge-developing';
});

Handlebars.registerHelper('readinessLabel', (rating: string) => {
  const map: Record<string, string> = {
    ready_now: 'Ready Now',
    '1_2_years': '1–2 Years',
    developing: 'Developing',
    not_yet_ready: 'Not Yet Ready',
  };
  return map[rating] ?? rating;
});

Handlebars.registerHelper('readinessNarrative', (rating: string, name: string) => {
  const narratives: Record<string, string> = {
    ready_now: `${name} demonstrates the capabilities, experience, and potential to step into the target role immediately. Readiness indicators across all five assessed dimensions are strong.`,
    '1_2_years': `${name} is on a strong developmental trajectory and is projected to be ready for the target role within 1–2 years with targeted support and stretch opportunities.`,
    developing: `${name} is actively building the required capabilities. A structured development plan with coaching and experiential learning is recommended over the next 2–3 years.`,
    not_yet_ready: `${name} requires significant development across multiple dimensions before being ready for the target role. A long-term, supported development programme is recommended.`,
  };
  return narratives[rating] ?? '';
});

const REPORTS_DIR = path.resolve(process.cwd(), 'reports');

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly templatesDir = path.resolve(__dirname, 'templates');

  constructor() {
    // Ensure reports output directory exists
    if (!fs.existsSync(REPORTS_DIR)) {
      fs.mkdirSync(REPORTS_DIR, { recursive: true });
    }
  }

  /**
   * Compiles a Handlebars template file with provided data and returns HTML.
   */
  buildReportHtml(templateName: string, data: Record<string, unknown>): string {
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template not found: ${templatePath}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = Handlebars.compile(templateSource);
    return template(data);
  }

  /**
   * Generates a PDF from HTML content and saves to the local reports directory.
   * Returns the saved file path.
   */
  async generatePdf(htmlContent: string, outputPath: string): Promise<string> {
    // Lazy-load Puppeteer to avoid startup costs
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.pdf({
        path: outputPath,
        format: 'A4',
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
        printBackground: true,
      });

      this.logger.log(`PDF generated: ${outputPath}`);
      return outputPath;
    } finally {
      await browser.close();
    }
  }

  /**
   * Generates a 360° feedback PDF report.
   */
  async generate360Report(data: {
    participantName: string;
    jobTitle: string;
    assessmentTitle: string;
    organisationName: string;
    generatedDate: string;
    totalRaters: number;
    perspectives: string;
    ratingScale: number;
    scores: Array<{
      competencyId: string;
      competencyName: string;
      byPerspective: Record<string, { mean: number; count: number }>;
      overallMean: number;
      gapVsSelf: number | null;
    }>;
    openComments: string[];
    developmentAreas: Array<{
      competencyName: string;
      score: number;
      gap: number | null;
      suggestion: string;
    }>;
  }): Promise<string> {
    const html = this.buildReportHtml('360-feedback', { ...data, maxScale: data.ratingScale });
    const filename = `360-${data.participantName.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    return this.generatePdf(html, outputPath);
  }

  /**
   * Generates a competency profile PDF report.
   */
  async generateCompetencyReport(data: {
    participantName: string;
    jobTitle: string;
    assessmentTitle: string;
    organisationName: string;
    generatedDate: string;
    domains: Array<{
      domainName: string;
      colour: string;
      averageSelfRating: number | null;
      averageManagerRating: number | null;
      competencies: Array<{
        name: string;
        selfRating: number | null;
        managerRating: number | null;
        gap: number | null;
        evidenceText?: string;
        developmentComment?: string;
      }>;
    }>;
    developmentAreas: Array<{
      competencyName: string;
      selfRating: number | null;
      managerRating: number | null;
      gap: number | null;
      developmentComment?: string;
    }>;
  }): Promise<string> {
    const html = this.buildReportHtml('competency', data);
    const filename = `competency-${data.participantName.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    return this.generatePdf(html, outputPath);
  }

  /**
   * Generates a Big Five personality PDF report.
   */
  async generatePersonalityReport(data: {
    participantName: string;
    jobTitle: string;
    assessmentTitle: string;
    organisationName: string;
    generatedDate: string;
    factors: Array<{
      factor: string;
      label: string;
      tScore: number;
      rawScore: number;
      percentile: number;
      narrative: string;
      markerPosition: number;
    }>;
    leadershipImplications: Array<{ factor: string; implication: string }>;
  }): Promise<string> {
    const html = this.buildReportHtml('personality', data);
    const filename = `personality-${data.participantName.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    return this.generatePdf(html, outputPath);
  }

  /**
   * Generates a leadership readiness PDF report.
   */
  async generateReadinessReport(data: {
    participantName: string;
    jobTitle: string;
    assessmentTitle: string;
    organisationName: string;
    generatedDate: string;
    targetRole?: string;
    readinessRating: string;
    compositeScore: number;
    competencyScore: number;
    feedbackScore: number;
    sjtScore: number;
    learningAgilityScore: number;
    personalityFitScore: number;
    gridPerformance: string;
    gridPotential: string;
    developmentActions: Array<{
      priority: number;
      area: string;
      action: string;
      timeline?: string;
    }>;
  }): Promise<string> {
    const html = this.buildReportHtml('readiness', data);
    const filename = `readiness-${data.participantName.replace(/\s+/g, '_')}-${Date.now()}.pdf`;
    const outputPath = path.join(REPORTS_DIR, filename);
    return this.generatePdf(html, outputPath);
  }
}
