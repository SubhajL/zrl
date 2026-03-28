import { Injectable, Logger } from '@nestjs/common';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type {
  DirectEmailInput,
  NotificationChannelDispatcher,
  NotificationChannelPreference,
  NotificationDeliveryTarget,
  NotificationRecord,
} from './notification.types';

interface PushWebhookPayload {
  userId: string;
  endpoint: string;
  notificationId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  createdAt: string;
}

@Injectable()
export class NotificationChannels implements NotificationChannelDispatcher {
  private readonly logger = new Logger(NotificationChannels.name);
  private readonly sesClient: SESClient | null;
  private readonly sesRegion: string | null;
  private readonly sesFromAddress: string | null;
  private readonly pushWebhookUrl: string | null;
  private readonly lineWebhookUrl: string | null;

  constructor() {
    this.sesRegion = process.env['AWS_SES_REGION']?.trim() || null;
    this.sesFromAddress = process.env['AWS_SES_FROM_EMAIL']?.trim() || null;
    this.pushWebhookUrl =
      process.env['NOTIFICATIONS_PUSH_WEBHOOK_URL']?.trim() || null;
    this.lineWebhookUrl = process.env['LINE_CHANNEL_ACCESS_TOKEN']?.trim()
      ? 'https://api.line.me/v2/bot/message/push'
      : null;
    this.sesClient =
      this.sesRegion === null || this.sesFromAddress === null
        ? null
        : new SESClient({ region: this.sesRegion });
  }

  async dispatch(
    notification: NotificationRecord,
    preference: NotificationChannelPreference,
    target: NotificationDeliveryTarget | null,
  ): Promise<void> {
    const tasks: Promise<void>[] = [];

    if (preference.emailEnabled) {
      tasks.push(this.sendEmail(notification, target));
    }
    if (preference.pushEnabled) {
      tasks.push(this.sendPush(notification, target));
    }
    if (preference.lineEnabled) {
      tasks.push(this.sendLine(notification, target));
    }

    await Promise.all(tasks);
  }

  async sendDirectEmail(input: DirectEmailInput): Promise<void> {
    const recipient = input.to.trim();
    if (recipient.length === 0) {
      throw new Error('Recipient email is required.');
    }

    await this.deliverEmail({
      to: recipient,
      subject: input.subject,
      message: input.message,
      context: 'mandatory privacy email',
      required: true,
    });
  }

  private async sendEmail(
    notification: NotificationRecord,
    target: NotificationDeliveryTarget | null,
  ): Promise<void> {
    await this.deliverEmail({
      to: target?.email ?? null,
      subject: notification.title,
      message: `${notification.message}\n\nNotification ID: ${notification.id}`,
      context: `notification email for ${notification.id}`,
      required: false,
    });
  }

  private async sendPush(
    notification: NotificationRecord,
    target: NotificationDeliveryTarget | null,
  ): Promise<void> {
    const endpoint = target?.pushEndpoint ?? null;
    if (endpoint === null) {
      this.logger.warn(
        `Skipping push notification for ${notification.id}: user push endpoint unavailable.`,
      );
      return;
    }

    if (this.pushWebhookUrl === null) {
      this.logger.warn(
        `Skipping push notification for ${notification.id}: push webhook is not configured.`,
      );
      return;
    }

    const payload: PushWebhookPayload = {
      userId: notification.userId,
      endpoint,
      notificationId: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      createdAt: notification.createdAt.toISOString(),
    };
    await this.postJson(this.pushWebhookUrl, payload, undefined);
  }

  private sendLine(
    notification: NotificationRecord,
    target: NotificationDeliveryTarget | null,
  ): Promise<void> {
    const channelToken = process.env['LINE_CHANNEL_ACCESS_TOKEN']?.trim() || '';
    if (this.lineWebhookUrl === null || channelToken.length === 0) {
      this.logger.warn(
        `Skipping LINE notification for ${notification.id}: LINE is not configured.`,
      );
      return Promise.resolve();
    }

    const lineUserId = target?.lineUserId ?? null;
    if (lineUserId === null) {
      this.logger.warn(
        `Skipping LINE notification for ${notification.id}: LINE recipient unavailable.`,
      );
      return Promise.resolve();
    }

    return this.postJson(
      this.lineWebhookUrl,
      {
        to: lineUserId,
        messages: [
          {
            type: 'text',
            text: `${notification.title}\n${notification.message}`,
          },
        ],
      },
      {
        Authorization: `Bearer ${channelToken}`,
      },
    );
  }

  private async postJson(
    url: string,
    body: object,
    extraHeaders: Record<string, string> | undefined,
  ): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Notification channel request failed with ${response.status}.`,
      );
    }
  }

  private async deliverEmail(input: {
    to: string | null;
    subject: string;
    message: string;
    context: string;
    required: boolean;
  }): Promise<void> {
    if (this.sesClient === null || this.sesFromAddress === null) {
      if (input.required) {
        throw new Error('SES is not configured.');
      }

      this.logger.warn(`Skipping ${input.context}: SES is not configured.`);
      return;
    }

    if (input.to === null || input.to.trim().length === 0) {
      if (input.required) {
        throw new Error('Recipient email is unavailable.');
      }

      this.logger.warn(
        `Skipping ${input.context}: recipient email unavailable.`,
      );
      return;
    }

    await this.sesClient.send(
      new SendEmailCommand({
        Source: this.sesFromAddress,
        Destination: {
          ToAddresses: [input.to],
        },
        Message: {
          Subject: {
            Data: input.subject,
          },
          Body: {
            Text: {
              Data: input.message,
            },
          },
        },
      }),
    );
  }
}
