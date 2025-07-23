import { WebClient } from "@slack/web-api";
import { logger } from "../utils/logger.js";
import { SessionData, createFileStorage } from "../utils/file-storage.js";

interface ThreadManagerConfig {
  client: WebClient | null;
  channel: string;
  timeoutSeconds?: number;
  storageDir?: string;
}

interface ThreadManagerState {
  cleanupInterval: NodeJS.Timeout | null;
}

interface ThreadMessage {
  sessionId: string;
  cwd: string;
  timestamp: string;
}

// Create initial thread message
const createInitialThreadMessage = (
  sessionId: string,
  message: ThreadMessage,
) => {
  const timestamp = new Date(message.timestamp).toLocaleString();

  return {
    text: `New Claude Code session started`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "🤖 Claude Code Session",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Session ID:*\n\`${sessionId}\``,
          },
          {
            type: "mrkdwn",
            text: `*Started:*\n${timestamp}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Working directory: \`${message.cwd}\``,
          },
        ],
      },
      {
        type: "divider",
      },
    ],
  };
};

// Get or create thread for a session
export const getOrCreateThread = async (
  sessionId: string,
  message: ThreadMessage,
  config: ThreadManagerConfig,
): Promise<string> => {
  const fileStorage = createFileStorage({ storageDir: config.storageDir });

  // Check if we have an existing thread for this session in storage
  const existingSession = await fileStorage.loadSession(sessionId);
  if (existingSession) {
    // Update last activity and save
    const updatedSession: SessionData = {
      ...existingSession,
      lastActivity: Date.now(),
    };
    await fileStorage.saveSession(sessionId, updatedSession);

    logger.debug("Using existing thread from storage", {
      sessionId,
      threadTs: existingSession.threadTs,
    });
    return existingSession.threadTs;
  }

  // Create a new thread
  if (!config.client) {
    throw new Error("Slack client not initialized");
  }

  const initialMessage = createInitialThreadMessage(sessionId, message);

  try {
    const result = await config.client.chat.postMessage({
      channel: config.channel,
      ...initialMessage,
    });

    if (!result.ts) {
      throw new Error("Failed to create thread - no timestamp returned");
    }

    const sessionData: SessionData = {
      threadTs: result.ts,
      lastActivity: Date.now(),
      sessionId,
      channel: config.channel,
    };

    await fileStorage.saveSession(sessionId, sessionData);
    logger.info("Created new thread and saved to storage", {
      sessionId,
      threadTs: result.ts,
    });

    return result.ts;
  } catch (error) {
    throw new Error(
      `Failed to create thread: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Create thread manager with cleanup functionality
export const createThreadManager = (config: ThreadManagerConfig) => {
  const state: ThreadManagerState = {
    cleanupInterval: null,
  };

  const timeoutMs = (config.timeoutSeconds || 3600) * 1000;
  const fileStorage = createFileStorage({ storageDir: config.storageDir });

  // Start cleanup interval
  const startCleanup = () => {
    // Run initial cleanup
    fileStorage.cleanupOldSessions(timeoutMs).catch((error) => {
      logger.error("Failed to run initial cleanup", error);
    });

    // Schedule periodic cleanup
    state.cleanupInterval = setInterval(
      async () => {
        await fileStorage.cleanupOldSessions(timeoutMs);
      },
      5 * 60 * 1000, // Every 5 minutes
    );
  };

  // Stop cleanup interval
  const destroy = () => {
    if (state.cleanupInterval) {
      clearInterval(state.cleanupInterval);
      state.cleanupInterval = null;
    }
  };

  // Start cleanup on creation
  startCleanup();

  return {
    getOrCreateThread: (sessionId: string, message: ThreadMessage) =>
      getOrCreateThread(sessionId, message, config),
    destroy,
  };
};
