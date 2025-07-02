import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { MessageSanitizer } from './messageSanitizer';
import { DiscordMessage, AppConfig } from './types';

export class SourceChannelService {
  private sanitizer: MessageSanitizer;

  constructor(
    private channelName: string,
    private channelId: string,
    private config: AppConfig,
    private prisma: PrismaClient,
    private authToken: string
  ) {
    this.sanitizer = new MessageSanitizer(config.string_filters);
  }

  async fetchAndStoreMessages(): Promise<void> {
    try {
      const messages = await this.fetchFromDiscord();
      if (!messages || messages.length === 0) {
        console.log(`No new messages found for channel ${this.channelName}`);
        return;
      }

      for (const message of messages.slice(0, this.config.message_batch_size)) {
        if (this.shouldProcessMessage(message)) {
          await this.storeRawMessage(message);
        }
      }

      // Update channel metadata
      await this.updateChannelMetadata(messages.length);
    } catch (error) {
      console.error(
        `Error in fetchAndStoreMessages for ${this.channelName}:`,
        error
      );
    }
  }

  private async fetchFromDiscord(): Promise<DiscordMessage[]> {
    try {
      const response = await axios.get(
        `https://discord.com/api/v9/channels/${this.channelId}/messages`,
        {
          headers: { authorization: this.authToken },
          params: { limit: this.config.message_batch_size },
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        `Failed to fetch messages from ${this.channelName}:`,
        error
      );
      return [];
    }
  }

  private async storeRawMessage(message: any): Promise<void> {
    try {
      // Extract image URLs from attachments
      const imageUrls: string[] = [];
      if (message.attachments) {
        for (const attachment of message.attachments) {
          if (attachment.content_type?.includes('image')) {
            imageUrls.push(attachment.url);
          }
        }
      }

      // Sanitize content
      const sanitizedContent = message.content
        ? this.sanitizer.sanitize(message.content)
        : '';

      await this.prisma.discordMessage.upsert({
        where: {
          msgId_channelName: {
            msgId: message.id,
            channelName: this.channelName,
          },
        },
        update: {}, // Don't update existing messages
        create: {
          msgId: message.id,
          channelName: this.channelName,
          content: sanitizedContent,
          attachments: message.attachments || undefined,
          referenceMsg: message.referenced_message || undefined,
          imageUrl: imageUrls.length > 0 ? imageUrls : undefined,
          timestamp: message.timestamp ? new Date(message.timestamp) : null,
          relayed: 0,
        },
      });

      console.log(
        `Stored message ${message.id} for channel ${this.channelName}`
      );
    } catch (error) {
      console.error(`Error storing message ${message.id}:`, error);
    }
  }

  private shouldProcessMessage(message: DiscordMessage): boolean {
    // Channel-specific filtering rules
    const rules = this.config.channel_rules?.[this.channelName];
    if (rules?.content_filter) {
      return message.content?.includes(rules.content_filter) ?? false;
    }
    return true;
  }

  private async updateChannelMetadata(messageCount: number): Promise<void> {
    await this.prisma.channelMetadata.upsert({
      where: { channelName: this.channelName },
      update: {
        lastProcessedAt: new Date(),
        messageCount: { increment: messageCount },
      },
      create: {
        channelName: this.channelName,
        channelId: this.channelId,
        lastProcessedAt: new Date(),
        messageCount: messageCount,
      },
    });
  }
}
