import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';

interface SendOptions {
  orgId: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  private async saveAndLog(
    orgId: string,
    email: string,
    type: string,
    templateKey: string,
    payload: Record<string, unknown>,
    userId?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      organisationId: orgId,
      userId: userId ?? null,
      email,
      type,
      templateKey,
      payload,
      status: 'sent',
      sentAt: new Date(),
    });

    const saved = await this.notificationRepo.save(notification);

    // In local dev — log the email instead of sending
    this.logger.log(
      `[EMAIL] to=${email} template=${templateKey} payload=${JSON.stringify(payload)}`,
    );

    return saved;
  }

  /**
   * Sends an invitation email to a participant starting their self-assessment.
   */
  async sendInvitation(
    to: string,
    participantName: string,
    assessmentTitle: string,
    selfAssessmentUrl: string,
    options: SendOptions,
  ): Promise<void> {
    await this.saveAndLog(
      options.orgId,
      to,
      'invitation',
      'participant_invitation',
      {
        participantName,
        assessmentTitle,
        selfAssessmentUrl,
        ...(options.payload ?? {}),
      },
      options.userId,
    );
  }

  /**
   * Sends a rater invitation email with the unique token URL.
   */
  async sendRaterInvitation(
    to: string,
    participantName: string,
    assessmentTitle: string,
    raterUrl: string,
    anonymityNote: string,
    options: SendOptions,
  ): Promise<void> {
    await this.saveAndLog(
      options.orgId,
      to,
      'rater_invitation',
      'rater_invitation',
      {
        participantName,
        assessmentTitle,
        raterUrl,
        anonymityNote,
        ...(options.payload ?? {}),
      },
      options.userId,
    );
  }

  /**
   * Sends a reminder to a rater or participant who has not yet completed.
   */
  async sendReminder(
    to: string,
    name: string,
    assessmentTitle: string,
    dueDate: string,
    options: SendOptions,
  ): Promise<void> {
    await this.saveAndLog(
      options.orgId,
      to,
      'reminder',
      'assessment_reminder',
      {
        name,
        assessmentTitle,
        dueDate,
        ...(options.payload ?? {}),
      },
      options.userId,
    );
  }

  /**
   * Notifies a participant that their report is ready for download.
   */
  async sendReportReady(
    to: string,
    name: string,
    reportDownloadUrl: string,
    options: SendOptions,
  ): Promise<void> {
    await this.saveAndLog(
      options.orgId,
      to,
      'report_ready',
      'report_ready',
      {
        name,
        reportDownloadUrl,
        ...(options.payload ?? {}),
      },
      options.userId,
    );
  }

  /**
   * Lists notifications for an org, optionally filtered by userId.
   */
  async listNotifications(orgId: string, userId?: string): Promise<Notification[]> {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.organisation_id = :orgId', { orgId })
      .orderBy('n.created_at', 'DESC')
      .take(100);

    if (userId) {
      qb.andWhere('n.user_id = :userId', { userId });
    }

    return qb.getMany();
  }
}
