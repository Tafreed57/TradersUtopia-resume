import { Handler, EventBridgeEvent } from 'aws-lambda';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { PrismaClient } from '@prisma/client';
import { MessageCollectorService } from './lib/messageCollector';
import { AppConfig } from './lib/types';
import discordConfig from './config/discord-config.json';

// Initialize clients outside handler for connection reuse
const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'us-east-1',
});
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Cache for secrets and config
let cachedSecrets: { databaseUrl?: string; discordToken?: string } = {};
let collectorInstance: MessageCollectorService | null = null;

// Interface for EventBridge scheduled events
interface DiscordCollectorEvent {
  source: 'aws.events';
  'detail-type': 'Scheduled Event';
  detail?: {
    action?: string;
  };
}

async function getSecret(secretName: string): Promise<string> {
  try {
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await secretsClient.send(command);
    return response.SecretString || '';
  } catch (error) {
    console.error(`Failed to get secret ${secretName}:`, error);
    throw error;
  }
}

async function initializeSecrets(): Promise<void> {
  if (!cachedSecrets.databaseUrl || !cachedSecrets.discordToken) {
    console.log('Loading secrets from AWS Secrets Manager...');

    const [databaseUrl, discordToken] = await Promise.all([
      getSecret('tradersutopia/database-url'),
      getSecret('tradersutopia/discord-token'),
    ]);

    cachedSecrets = { databaseUrl, discordToken };

    // Update Prisma client with the actual database URL
    if (databaseUrl) {
      process.env.DATABASE_URL = databaseUrl;
    }

    console.log('✅ Secrets loaded successfully');
  }
}

async function initializeCollector(): Promise<MessageCollectorService> {
  if (!collectorInstance) {
    await initializeSecrets();

    if (!cachedSecrets.discordToken) {
      throw new Error('Discord token not available');
    }

    const config: AppConfig = discordConfig as AppConfig;

    collectorInstance = new MessageCollectorService(
      config,
      prisma,
      cachedSecrets.discordToken
    );

    console.log(
      `✅ Discord collector initialized for ${
        Object.keys(config.source_channels).length
      } channels`
    );
  }

  return collectorInstance;
}

async function collectMessages(): Promise<void> {
  const startTime = Date.now();
  console.log('🚀 Starting Discord message collection cycle...');

  try {
    // Initialize collector if needed
    const collector = await initializeCollector();

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection established');

    // Get channel information
    const channelNames = collector.getChannelNames();
    console.log(
      `📊 Processing ${channelNames.length} channels: ${channelNames.join(
        ', '
      )}`
    );

    // Run collection cycle
    const sourceChannels = (collector as any).sourceChannels;
    const promises = Array.from(sourceChannels.values()).map((service: any) =>
      service.fetchAndStoreMessages().catch((error: Error) => {
        console.error('Error collecting messages from channel:', error);
        return null; // Continue with other channels even if one fails
      })
    );

    const results = await Promise.allSettled(promises);

    // Log results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(
      `📈 Collection results: ${successful} successful, ${failed} failed`
    );

    if (failed > 0) {
      console.warn(`⚠️ ${failed} channels failed to process`);
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Collection cycle completed in ${duration}ms`);
  } catch (error) {
    console.error('❌ Error during message collection:', error);
    throw error;
  } finally {
    // Don't disconnect Prisma in Lambda - keep connection warm
    // await prisma.$disconnect();
  }
}

// Main Lambda handler
export const handler: Handler<
  EventBridgeEvent<string, DiscordCollectorEvent>,
  void
> = async (event, context) => {
  // Optimize for connection reuse
  context.callbackWaitsForEmptyEventLoop = false;

  console.log('🎯 Discord Collector Lambda invocation:', {
    source: event.source,
    detailType: event['detail-type'],
    time: event.time,
    remainingTime: context.getRemainingTimeInMillis(),
  });

  try {
    await collectMessages();

    console.log('🎉 Discord collection completed successfully', {
      timestamp: new Date().toISOString(),
      channels: collectorInstance?.getChannelCount() || 0,
    });
  } catch (error) {
    console.error('❌ Discord collection failed:', error);

    // Re-throw error for Lambda to handle retry logic
    throw new Error(
      `Discord collection failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
};
