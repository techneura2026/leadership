import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { ReportType } from '@leaderprism/shared';
import { Report } from './report.entity';
import { PdfService } from './pdf.service';
import { Assessment } from '../assessment/engine/entities/assessment.entity';
import { AssessmentParticipant } from '../assessment/engine/entities/assessment-participant.entity';
import { User } from '../core/users/entities/user.entity';
import { Uc1FeedbackService } from '../assessment/uc1-feedback/uc1-feedback.service';
import { Uc2CompetencyService } from '../assessment/uc2-competency/uc2-competency.service';
import { Uc3PersonalityService } from '../assessment/uc3-personality/uc3-personality.service';
import { Uc4ReadinessService } from '../assessment/uc4-readiness/uc4-readiness.service';
import { ReadinessScore } from '../assessment/uc4-readiness/entities/readiness-score.entity';
import { NotificationsService } from '../core/notifications/notifications.service';

@Injectable()
export class ReportingService {
  private readonly logger = new Logger(ReportingService.name);

  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,
    @InjectRepository(Assessment)
    private readonly assessmentRepo: Repository<Assessment>,
    @InjectRepository(AssessmentParticipant)
    private readonly participantRepo: Repository<AssessmentParticipant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ReadinessScore)
    private readonly readinessScoreRepo: Repository<ReadinessScore>,
    private readonly pdfService: PdfService,
    private readonly uc1Service: Uc1FeedbackService,
    private readonly uc2Service: Uc2CompetencyService,
    private readonly uc3Service: Uc3PersonalityService,
    private readonly uc4Service: Uc4ReadinessService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue('reports')
    private readonly reportsQueue: Queue,
  ) {}

  /**
   * Creates the pending report record and enqueues the actual PDF generation as a
   * BullMQ job — returns immediately so the request doesn't block on Puppeteer.
   * The worker (ReportProcessor) calls processReport() to do the real work.
   */
  async requestReport(
    orgId: string,
    assessmentId: string,
    participantId: string | null,
    reportType: ReportType,
    language: string,
    generatedBy: string,
  ): Promise<Report> {
    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    const report = this.reportRepo.create({
      organisationId: orgId,
      assessmentId,
      participantId: participantId ?? null,
      reportType,
      status: 'pending',
      language,
      generatedBy,
    });
    const savedReport = await this.reportRepo.save(report);

    await this.reportsQueue.add('generate', { reportId: savedReport.id });

    return savedReport;
  }

  /** Does the actual PDF rendering for an already-created report record. Called by ReportProcessor. */
  async processReport(reportId: string): Promise<Report> {
    const savedReport = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!savedReport) throw new NotFoundException(`Report ${reportId} not found`);

    const orgId = savedReport.organisationId;
    const assessmentId = savedReport.assessmentId;
    const participantId = savedReport.participantId;
    const reportType = savedReport.reportType;

    const assessment = await this.assessmentRepo.findOne({
      where: { id: assessmentId, organisationId: orgId },
    });
    if (!assessment) throw new NotFoundException(`Assessment ${assessmentId} not found`);

    savedReport.status = 'processing';
    await this.reportRepo.save(savedReport);

    try {
      const generatedDate = new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      });

      let localPath: string;

      // Get participant/user info if applicable
      let participantUser: User | null = null;
      if (participantId) {
        const participant = await this.participantRepo.findOne({
          where: { id: participantId },
          relations: ['user'],
        });
        participantUser = (participant as any)?.user ?? null;
      }

      const participantName = participantUser
        ? `${participantUser.firstName} ${participantUser.lastName}`
        : 'Participant';

      const commonData = {
        participantName,
        jobTitle: participantUser?.jobTitle ?? '',
        assessmentTitle: assessment.title,
        organisationName: orgId,
        generatedDate,
      };

      switch (reportType) {
        case ReportType.INDIVIDUAL_360: {
          if (!participantId) throw new Error('participantId required for 360 report');
          const scores = await this.uc1Service.get360Scores(assessmentId, participantId, orgId);

          // Shuffle open comments for anonymity
          const allComments: string[] = [];
          const nominations = await this.uc1Service.getCompletedNominationsWithResponses(
            assessmentId,
            participantId,
          );
          for (const nom of nominations) {
            for (const resp of nom.responses ?? []) {
              if (resp.openText) {
                allComments.push(...resp.openText.split('\n---\n'));
              }
            }
          }
          // Fisher-Yates shuffle
          for (let i = allComments.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allComments[i], allComments[j]] = [allComments[j], allComments[i]];
          }

          const sortedByScore = [...scores].sort((a, b) => a.overallMean - b.overallMean);
          const developmentAreas = sortedByScore.slice(0, 3).map((s) => {
            const competencyName = s.competencyName ?? s.competencyId;
            return {
              competencyName,
              score: s.overallMean,
              gap: s.gapVsSelf,
              suggestion: this.competencyDevelopmentSuggestion(competencyName, s.overallMean, s.gapVsSelf),
            };
          });

          localPath = await this.pdfService.generate360Report({
            ...commonData,
            totalRaters: nominations.length,
            perspectives: Object.keys(
              nominations.reduce((acc, n) => ({ ...acc, [n.relationship]: true }), {}),
            ).join(', '),
            ratingScale: (assessment.config as any)?.ratingScale ?? 5,
            scores: scores.map((s) => ({ ...s, competencyName: s.competencyName ?? s.competencyId })),
            openComments: allComments,
            developmentAreas,
          });
          break;
        }

        case ReportType.COMPETENCY: {
          if (!participantId) throw new Error('participantId required for competency report');
          const profile = await this.uc2Service.getCompetencyProfile(
            assessmentId,
            participantId,
            orgId,
          );

          const allComps = profile.flatMap((d) => d.competencies);
          const sortedByGap = [...allComps]
            .filter((c) => c.gap !== null)
            .sort((a, b) => (a.gap ?? 0) - (b.gap ?? 0));

          localPath = await this.pdfService.generateCompetencyReport({
            ...commonData,
            domains: profile.map((d) => ({
              domainName: d.domainName,
              colour: d.domainColour,
              averageSelfRating: d.averageSelfRating,
              averageManagerRating: d.averageManagerRating,
              competencies: d.competencies.map((c) => ({
                name: c.name,
                selfRating: c.selfRating,
                managerRating: c.managerRating,
                gap: c.gap,
              })),
            })),
            developmentAreas: sortedByGap.slice(0, 3).map((c) => ({
              competencyName: c.name,
              selfRating: c.selfRating,
              managerRating: c.managerRating,
              gap: c.gap,
            })),
          });
          break;
        }

        case ReportType.PERSONALITY: {
          if (!participantId) throw new Error('participantId required for personality report');
          const scores = await this.uc3Service.getScores(assessmentId, participantId, orgId);

          const factorLabels: Record<string, string> = {
            openness: 'Openness to Experience',
            conscientiousness: 'Conscientiousness',
            extraversion: 'Extraversion',
            agreeableness: 'Agreeableness',
            emotional_stability: 'Emotional Stability',
          };

          localPath = await this.pdfService.generatePersonalityReport({
            ...commonData,
            factors: scores.map((s) => ({
              factor: s.factor,
              label: factorLabels[s.factor] ?? s.factor,
              tScore: s.tScore,
              rawScore: s.rawScore,
              percentile: s.percentile,
              narrative: s.narrative,
              markerPosition: Math.round(((s.tScore - 20) / 60) * 100),
            })),
            leadershipImplications: scores.map((s) => ({
              factor: factorLabels[s.factor] ?? s.factor,
              implication: s.narrative.split('.').slice(0, 2).join('.') + '.',
            })),
          });
          break;
        }

        case ReportType.READINESS: {
          if (!participantId) throw new Error('participantId required for readiness report');
          const readinessScore = await this.readinessScoreRepo.findOne({
            where: { assessmentId, participantId },
            relations: ['roleProfile'],
          });

          if (!readinessScore) throw new NotFoundException('Readiness score not computed yet');

          localPath = await this.pdfService.generateReadinessReport({
            ...commonData,
            targetRole: readinessScore.roleProfile?.title,
            readinessRating: readinessScore.readinessRating,
            compositeScore: Number(readinessScore.compositeScore),
            competencyScore: Number(readinessScore.competencyScore),
            feedbackScore: Number(readinessScore.feedbackScore),
            sjtScore: Number(readinessScore.sjtScore),
            learningAgilityScore: Number(readinessScore.learningAgilityScore),
            personalityFitScore: Number(readinessScore.personalityFitScore),
            gridPerformance: readinessScore.gridPerformance,
            gridPotential: readinessScore.gridPotential,
            developmentActions: [
              { priority: 1, area: 'Competency Development', action: 'Focus on lowest-rated competencies identified in the competency assessment.', timeline: '3-6 months' },
              { priority: 2, area: 'Leadership Experience', action: 'Seek stretch assignments that develop the target role skill set.', timeline: '6-12 months' },
              { priority: 3, area: 'Coaching & Mentoring', action: 'Engage a senior mentor in the target function for regular guidance.', timeline: 'Ongoing' },
            ],
          });
          break;
        }

        default:
          throw new Error(`Unsupported report type: ${reportType}`);
      }

      // Update report record with success
      savedReport.status = 'ready';
      savedReport.localPath = localPath;
      savedReport.generatedAt = new Date();
      await this.reportRepo.save(savedReport);

      // Send notification if participant user exists
      if (participantUser) {
        await this.notificationsService.sendReportReady(
          participantUser.email,
          participantName,
          `/api/reports/${savedReport.id}/download`,
          { orgId },
        );
      }

      this.logger.log(`Report ${savedReport.id} generated: ${localPath}`);
      return savedReport;
    } catch (err) {
      savedReport.status = 'failed';
      await this.reportRepo.save(savedReport);
      this.logger.error(`Report generation failed for ${savedReport.id}:`, err);
      throw err;
    }
  }

  async getReport(id: string, orgId: string): Promise<Report> {
    const report = await this.reportRepo.findOne({
      where: { id, organisationId: orgId },
    });
    if (!report) throw new NotFoundException(`Report ${id} not found`);
    return report;
  }

  async getDownloadPath(id: string, orgId: string): Promise<string> {
    const report = await this.getReport(id, orgId);

    if (report.status !== 'ready') {
      throw new Error(`Report is not ready (status: ${report.status})`);
    }

    // Local dev: return file path; prod: would return signed blob URL
    return report.localPath ?? report.blobUrl ?? '';
  }

  async listReports(orgId: string, assessmentId?: string): Promise<Report[]> {
    const qb = this.reportRepo
      .createQueryBuilder('r')
      .where('r.organisation_id = :orgId', { orgId })
      .orderBy('r.created_at', 'DESC');

    if (assessmentId) {
      qb.andWhere('r.assessment_id = :assessmentId', { assessmentId });
    }

    return qb.getMany();
  }

  /**
   * Participant-facing: reports where the requesting user is the subject. Previously the
   * entire /reports resource was ORG_ADMIN/HR_MANAGER-only, so a participant could never
   * download their own PDF (see docs/frontend-backend-gap-remediation-plan.md Tier 0 item 0h).
   */
  async listMyReports(orgId: string, userId: string): Promise<Report[]> {
    return this.reportRepo
      .createQueryBuilder('r')
      .innerJoin('r.participant', 'p')
      .where('r.organisation_id = :orgId', { orgId })
      .andWhere('p.user_id = :userId', { userId })
      .orderBy('r.created_at', 'DESC')
      .getMany();
  }

  async getMyDownloadPath(id: string, orgId: string, userId: string): Promise<string> {
    const report = await this.reportRepo.findOne({
      where: { id, organisationId: orgId },
      relations: ['participant'],
    });
    if (!report || report.participant?.userId !== userId) {
      // Same response whether the report doesn't exist or isn't theirs — don't confirm
      // existence of another participant's report via a 403 vs 404 distinction.
      throw new NotFoundException(`Report ${id} not found`);
    }

    if (report.status !== 'ready') {
      throw new Error(`Report is not ready (status: ${report.status})`);
    }

    return report.localPath ?? report.blobUrl ?? '';
  }

  /**
   * Builds a per-competency development suggestion for the 360 report from the actual
   * score band and self-vs-others gap, instead of a single generic sentence for every
   * competency. gapVsSelf = raters' mean − self rating: positive means raters saw them
   * more favourably than they rated themselves; negative means the reverse.
   */
  private competencyDevelopmentSuggestion(
    competencyName: string,
    score: number,
    gap: number | null,
  ): string {
    const urgency = score < 2.5 ? 'a foundational development priority' : 'an area with room to grow';

    if (gap === null) {
      return `${competencyName} is ${urgency} based on rater feedback. Seek specific examples from colleagues on what stronger performance in this area looks like, and agree on one or two concrete behaviours to practise.`;
    }

    if (gap >= 0.5) {
      return `Raters rated ${competencyName} noticeably higher than the self-assessment — this is likely a blind spot in the other direction: real capability that isn't being recognised or claimed. Ask a trusted colleague or manager for specific examples of when this showed up well, and build confidence in applying it more visibly.`;
    }

    if (gap <= -0.5) {
      return `There is a meaningful gap between the self-assessment and how raters experienced ${competencyName} — self-perception here is running ahead of how others see it. Prioritise asking for specific, behavioural feedback on ${competencyName} to recalibrate, then focus development effort on the gap that surfaces.`;
    }

    return `${competencyName} is ${urgency}, and self- and rater perceptions are well aligned here. Focus on targeted coaching or a stretch assignment that exercises this competency directly, and track progress against specific behavioural indicators.`;
  }
}
