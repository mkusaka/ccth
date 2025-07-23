import { parseHookEvent } from "./schemas/hook-event.schema.js";
import { WebClient } from "@slack/web-api";
import { getOrCreateThread } from "./slack/thread-manager.js";
import { formatHookEventForSlack } from "./slack/message-formatter.js";
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

        // Parse as HookEvent
        const hookEvent = parseHookEvent(jsonData);
        if (!hookEvent) {
          throw new Error("Invalid hook event format");
        }

        logger.info("Parsed hook event", {
          type: hookEvent.hook_event_name,
          sessionId: hookEvent.session_id,
        });

        // Format message for Slack
        const slackMessage = await formatHookEventForSlack(hookEvent);

        if (dryRun) {
          logger.info("Dry run mode - would send to Slack:", slackMessage);
          resolve();
          return;
        }

        // Send to Slack
        if (slackClient) {
          // For thread management, we need a dummy message object with session info
          const threadMessage = {
            sessionId: hookEvent.session_id,
            cwd: hookEvent.cwd,
            timestamp: new Date().toISOString(),
          };

          const threadTs = await getOrCreateThread(
            hookEvent.session_id,
            threadMessage,
            {
              client: slackClient,
              channel,
              timeoutSeconds: threadTimeoutSeconds,
              storageDir,
            },
          );

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
