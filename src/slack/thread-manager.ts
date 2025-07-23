import { WebClient } from "@slack/web-api";
import { SessionMessage } from "../schemas/session-message.schema.js";
import { logger } from "../utils/logger.js";

interface ThreadInfo {
  threadTs: string;
  lastActivity: number;
  sessionId: string;
}

export class ThreadManager {
  private threads: Map<string, ThreadInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private client: WebClient | null,
    private channel: string,
    private timeoutSeconds: number = 3600, // 1 hour default
  ) {
    // Start cleanup interval to remove old threads
    this.startCleanupInterval();
  }

  private startCleanupInterval(): void {
    // Check every 5 minutes for expired threads
    this.cleanupInterval = setInterval(
      () => {
        this.cleanupExpiredThreads();
      },
      5 * 60 * 1000,
    );
  }

  private cleanupExpiredThreads(): void {
    const now = Date.now();
    const timeout = this.timeoutSeconds * 1000;

    for (const [sessionId, threadInfo] of this.threads.entries()) {
      if (now - threadInfo.lastActivity > timeout) {
        logger.debug("Removing expired thread", {
          sessionId,
          threadTs: threadInfo.threadTs,
        });
        this.threads.delete(sessionId);
      }
    }
  }

  async getOrCreateThread(
    sessionId: string,
    message: SessionMessage,
  ): Promise<string> {
    // Check if we have an existing thread for this session
    const existingThread = this.threads.get(sessionId);
    if (existingThread) {
      existingThread.lastActivity = Date.now();
      logger.debug("Using existing thread", {
        sessionId,
        threadTs: existingThread.threadTs,
      });
      return existingThread.threadTs;
    }

    // Create a new thread
    if (!this.client) {
      throw new Error("Slack client not initialized");
    }

    const initialMessage = this.createInitialThreadMessage(sessionId, message);

    try {
      const result = await this.client.chat.postMessage({
        channel: this.channel,
        ...initialMessage,
      });

      if (!result.ts) {
        throw new Error("Failed to create thread - no timestamp returned");
      }

      const threadInfo: ThreadInfo = {
        threadTs: result.ts,
        lastActivity: Date.now(),
        sessionId,
      };

      this.threads.set(sessionId, threadInfo);
      logger.info("Created new thread", { sessionId, threadTs: result.ts });

      return result.ts;
    } catch (error) {
      throw new Error(
        `Failed to create thread: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  private createInitialThreadMessage(
    sessionId: string,
    message: SessionMessage,
  ) {
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
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.threads.clear();
  }
}
