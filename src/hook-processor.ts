import { parseSessionMessage } from "./schemas/session-message.schema.js";
import { WebClient } from "@slack/web-api";
import { getOrCreateThread } from "./slack/thread-manager.js";
import { formatMessageForSlack } from "./slack/message-formatter.js";
import { logger } from "./utils/logger.js";

interface ProcessOptions {
  slackClient: WebClient | null;
  channel: string;
  dryRun: boolean;
  threadTimeoutSeconds?: number;
  storageDir?: string;
}

export async function processHookInput(options: ProcessOptions): Promise<void> {
  const { slackClient, channel, dryRun, threadTimeoutSeconds, storageDir } =
    options;

  return new Promise((resolve, reject) => {
    let inputBuffer = "";

    // Read from stdin
    process.stdin.setEncoding("utf8");

    process.stdin.on("data", (chunk) => {
      inputBuffer += chunk;
    });

    process.stdin.on("end", async () => {
      try {
        logger.debug("Received input from stdin", {
          length: inputBuffer.length,
        });

        // Parse JSON input
        let jsonData: unknown;
        try {
          jsonData = JSON.parse(inputBuffer);
        } catch (error) {
          throw new Error(
            `Failed to parse JSON input: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }

        // Parse as SessionMessage
        const message = parseSessionMessage(jsonData);
        if (!message) {
          throw new Error("Invalid session message format");
        }

        logger.info("Parsed session message", {
          type: message.type,
          sessionId: message.sessionId,
          uuid: message.uuid,
        });

        // Format message for Slack
        const slackMessage = await formatMessageForSlack(message);

        if (dryRun) {
          logger.info("Dry run mode - would send to Slack:", slackMessage);
          resolve();
          return;
        }

        // Send to Slack
        if (slackClient) {
          const threadTs = await getOrCreateThread(message.sessionId, message, {
            client: slackClient,
            channel,
            timeoutSeconds: threadTimeoutSeconds,
            storageDir,
          });

          const result = await slackClient.chat.postMessage({
            channel,
            thread_ts: threadTs,
            ...slackMessage,
          });

          logger.info("Message sent to Slack", {
            ts: result.ts,
            thread_ts: threadTs,
            channel: result.channel,
          });
        }

        resolve();
      } catch (error) {
        logger.error("Error processing hook input:", error);
        reject(error);
      }
    });

    process.stdin.on("error", (error) => {
      logger.error("Error reading from stdin:", error);
      reject(error);
    });
  });
}
