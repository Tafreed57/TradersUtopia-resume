import { PrismaClient } from '@prisma/client';
import { SourceChannelService } from './sourceChannelService';
import { AppConfig } from './types';

export class MessageCollectorService {
  private sourceChannels: Map<string, SourceChannelService> = new Map();

  constructor(
    private config: AppConfig,
    private prisma: PrismaClient,
    private authToken: string
  ) {
    this.initializeSourceChannels();
  }

  private initializeSourceChannels(): void {
    for (const [channelName, channelId] of Object.entries(
      this.config.source_channels
    )) {
      const service = new SourceChannelService(
        channelName,
        channelId,
        this.config,
        this.prisma,
        this.authToken
      );
      this.sourceChannels.set(channelName, service);
    }
  }

  async collectAllMessages(): Promise<void> {
    console.log(
      `[${new Date().toISOString()}] Collecting messages from all channels...`
    );

    const promises = Array.from(this.sourceChannels.values()).map(service =>
      service.fetchAndStoreMessages().catch(error => {
        console.error('Error collecting messages:', error);
      })
    );

    await Promise.allSettled(promises);
    console.log('Message collection cycle completed');
  }

  getChannelCount(): number {
    return this.sourceChannels.size;
  }

  getChannelNames(): string[] {
    return Array.from(this.sourceChannels.keys());
  }
}
