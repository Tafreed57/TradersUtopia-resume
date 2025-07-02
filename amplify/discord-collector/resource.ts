import { defineFunction } from '@aws-amplify/backend';

export const discordCollector = defineFunction({
  name: 'discord-collector',
  entry: './handler.ts',
  timeoutSeconds: 300,
  memoryMB: 512,
  environment: {
    NAME: 'discord-collector',
    NODE_ENV: 'production',
    LOG_LEVEL: 'info',
    // DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    // DATABASE_URL: process.env.DATABASE_URL,
  },
});
