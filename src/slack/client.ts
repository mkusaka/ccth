import { WebClient } from '@slack/web-api';
import { logger } from '../utils/logger.js';

export async function initializeSlackClient(token: string): Promise<WebClient> {
  const client = new WebClient(token, {
    retryConfig: {
      retries: 3,
    },
  });

  // Test the connection
  try {
    const auth = await client.auth.test();
    logger.info('Slack client initialized successfully', {
      team: auth.team,
      user: auth.user,
    });
  } catch (error) {
    throw new Error(
      `Failed to initialize Slack client: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  return client;
}
