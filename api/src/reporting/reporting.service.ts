import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  ) {}

  async generateReport(
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

    // Create a pending report record
    const report = this.reportRepo.create({
      organisationId: orgId,
      assessmentId,
      participantId: participantId ?? null,
      reportType,
      status: 'processing',
      language,
      generatedBy,
    });
    const savedReport = await this.reportRepo.save(report);

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
          const developmentAreas = sortedByScore.slice(0, 3).map((s) => ({
            competencyName: s.competencyName ?? s.competencyId,
            score: s.overallMean,
            gap: s.gapVsSelf,
            suggestion: 'Review behavioural indicators at the next level and seek specific coaching in this area.',
          }));

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
}
