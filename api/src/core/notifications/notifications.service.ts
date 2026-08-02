import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailClient } from '@azure/communication-email';
import { Notification } from './notification.entity';

interface SendOptions {
  orgId: string;
  userId?: string;
  payload?: Record<string, unknown>;
}

interface EmailContent {
  subject: string;
  html: string;
  plainText: string;
}

/**
 * Builds the human-readable subject/body per template. Kept separate from the send
 * mechanics below so the "real" email has genuine content, not a JSON payload dump.
 */
function renderEmailContent(templateKey: string, payload: Record<string, unknown>): EmailContent {
  switch (templateKey) {
    case 'user_welcome':
      return {
        subject: `Welcome to LeaderPrism — your account is ready`,
        html: `
          <p>Hi ${payload.firstName},</p>
          <p>An account has been created for you on LeaderPrism.</p>
          <p><strong>Email:</strong> ${payload.email}<br/>
          <strong>Temporary password:</strong> ${payload.temporaryPassword}</p>
          <p>You'll be asked to set your own password the first time you log in.</p>
          <p><a href="${payload.loginUrl}">Log in to LeaderPrism</a></p>
        `,
        plainText: `Hi ${payload.firstName},\n\nAn account has been created for you on LeaderPrism.\nEmail: ${payload.email}\nTemporary password: ${payload.temporaryPassword}\n\nYou'll be asked to set your own password the first time you log in.\nLog in: ${payload.loginUrl}`,
      };
    case 'password_reset':
      return {
        subject: `Reset your LeaderPrism password`,
        html: `
          <p>Hi ${payload.firstName},</p>
          <p>We received a request to reset your LeaderPrism password. This link expires in 1 hour.</p>
          <p><a href="${payload.resetUrl}">Reset your password</a></p>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
        plainText: `Hi ${payload.firstName},\n\nWe received a request to reset your LeaderPrism password. This link expires in 1 hour.\nReset link: ${payload.resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
      };
    case 'participant_invitation':
      return {
        subject: `Action needed: ${payload.assessmentTitle}`,
        html: `
          <p>Hi ${payload.participantName},</p>
          <p>You've been invited to complete <strong>${payload.assessmentTitle}</strong>.</p>
          <p><a href="${payload.selfAssessmentUrl}">Start your assessment</a></p>
        `,
        plainText: `Hi ${payload.participantName},\n\nYou've been invited to complete ${payload.assessmentTitle}.\nStart here: ${payload.selfAssessmentUrl}`,
      };
    case 'rater_invitation':
      return {
        subject: `You've been asked to give feedback on ${payload.assessmentTitle}`,
        html: `
          <p>Hi,</p>
          <p>You've been asked to give feedback about <strong>${payload.participantName}</strong> as part of <strong>${payload.assessmentTitle}</strong>.</p>
          <p>${payload.anonymityNote}</p>
          <p><a href="${payload.raterUrl}">Give feedback</a></p>
        `,
        plainText: `You've been asked to give feedback about ${payload.participantName} as part of ${payload.assessmentTitle}.\n${payload.anonymityNote}\nGive feedback: ${payload.raterUrl}`,
      };
    case 'assessment_reminder':
      return {
        subject: `Reminder: ${payload.assessmentTitle} is due ${payload.dueDate}`,
        html: `<p>Hi ${payload.name},</p><p>This is a reminder that <strong>${payload.assessmentTitle}</strong> is due on ${payload.dueDate}.</p>`,
        plainText: `Hi ${payload.name},\n\nThis is a reminder that ${payload.assessmentTitle} is due on ${payload.dueDate}.`,
      };
    case 'report_ready':
      return {
        subject: `Your report is ready`,
        html: `<p>Hi ${payload.name},</p><p>Your report is ready to download.</p><p><a href="${payload.reportDownloadUrl}">Download report</a></p>`,
        plainText: `Hi ${payload.name},\n\nYour report is ready to download.\nDownload: ${payload.reportDownloadUrl}`,
      };
    default:
      return {
        subject: `LeaderPrism notification`,
        html: `<pre>${JSON.stringify(payload, null, 2)}</pre>`,
        plainText: JSON.stringify(payload, null, 2),
      };
  }
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly emailClient: EmailClient | null;
  private readonly senderAddress: string;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {
    const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
    this.senderAddress = process.env.EMAIL_FROM || 'no-reply@leaderprism.example';

    // No connection string configured (local dev / this env has no ACS resource provisioned
    // yet — see docs/azure_deployment_overview.md) — fall back to log-only, same as before.
    this.emailClient = connectionString ? new EmailClient(connectionString) : null;
    if (!this.emailClient) {
      this.logger.warn(
        'AZURE_COMMUNICATION_CONNECTION_STRING is not set — emails will be logged, not sent.',
      );
    }
  }

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
      status: 'pending',
      sentAt: null,
    });
    await this.notificationRepo.save(notification);

    if (!this.emailClient) {
      // Local dev / no ACS resource configured — log instead of sending, as before.
      this.logger.log(
        `[EMAIL] to=${email} template=${templateKey} payload=${JSON.stringify(payload)}`,
      );
      notification.status = 'sent';
      notification.sentAt = new Date();
      return this.notificationRepo.save(notification);
    }

    try {
      const content = renderEmailContent(templateKey, payload);
      const poller = await this.emailClient.beginSend({
        senderAddress: this.senderAddress,
        content: {
          subject: content.subject,
          html: content.html,
          plainText: content.plainText,
        },
        recipients: { to: [{ address: email }] },
      });
      await poller.pollUntilDone();

      notification.status = 'sent';
      notification.sentAt = new Date();
      this.logger.log(`Email sent to=${email} template=${templateKey}`);
    } catch (err: any) {
      // Don't let a transient email-provider failure fail the calling request (e.g. user
      // creation should still succeed even if the welcome email bounces) — log and move on.
      notification.status = 'failed';
      this.logger.error(`Failed to send email to=${email} template=${templateKey}: ${err?.message}`);
    }

    return this.notificationRepo.save(notification);
  }

  /**
   * Sends a new user their account credentials so they don't depend on the creating admin
   * manually relaying the temporary password out-of-band.
   */
  async sendUserWelcome(
    to: string,
    firstName: string,
    temporaryPassword: string,
    loginUrl: string,
    options: SendOptions,
  ): Promise<void> {
    await this.saveAndLog(
      options.orgId,
      to,
      'user_welcome',
      'user_welcome',
      { firstName, email: to, temporaryPassword, loginUrl, ...(options.payload ?? {}) },
      options.userId,
    );
  }

  /**
   * Sends a password-reset link. Payload never includes the raw token beyond the URL itself.
   */
  async sendPasswordReset(
    to: string,
    firstName: string,
    resetUrl: string,
    options: SendOptions,
  ): Promise<void> {
    await this.saveAndLog(
      options.orgId,
      to,
      'password_reset',
      'password_reset',
      { firstName, resetUrl, ...(options.payload ?? {}) },
      options.userId,
    );
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
      .where('n.organisationId = :orgId', { orgId })
      .orderBy('n.createdAt', 'DESC');

    if (userId) {
      qb.andWhere('n.userId = :userId', { userId });
    }

    return qb.getMany();
  }
}
