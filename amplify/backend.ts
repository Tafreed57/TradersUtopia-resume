import { defineBackend } from '@aws-amplify/backend';
import { discordCollector } from './discord-collector/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Duration } from 'aws-cdk-lib';

/**
 * @see https://docs.amplify.aws/nextjs/build-a-backend/functions/ to add storage, functions, and more
 */
const backend = defineBackend({
  discordCollector,
});

// Grant the Discord function access to secrets
backend.discordCollector.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['secretsmanager:GetSecretValue'],
    resources: [
      `arn:aws:secretsmanager:*:*:secret:tradersutopia/database-url*`,
      `arn:aws:secretsmanager:*:*:secret:tradersutopia/discord-token*`,
    ],
  })
);

// Create EventBridge rule to schedule the function every 15 seconds
new Rule(
  backend.createStack('DiscordScheduler'),
  'DiscordCollectorSchedule',
  {
    description: 'Trigger Discord collector every 15 seconds',
    schedule: Schedule.rate(Duration.seconds(15)),
    targets: [new LambdaFunction(backend.discordCollector.resources.lambda)],
  }
);
