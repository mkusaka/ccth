import { parseHookEvent } from "./schemas/hook-event.schema.js";
import { WebClient } from "@slack/web-api";
import { getOrCreateThread } from "./slack/thread-manager.js";
import { formatHookEventForSlack } from "./slack/message-formatter.js";
import { logger } from "./utils/logger.js";
import { createTranscriptReader } from "./utils/transcript-reader.js";
import { createFileStorage } from "./utils/file-storage.js";
import { sendUnsentAssistantMessages } from "./utils/assistant-message-handler.js";

interface ProcessOptions {
  slackClient: WebClient | null;
  channel: string;
  dryRun: boolean;
  threadTimeoutSeconds?: number;
  storageDir?: string;
  debug: boolean;
  trace?: boolean;
}

export async function processHookInput(options: ProcessOptions): Promise<void> {
  const {
    slackClient,
    channel,
    dryRun,
    threadTimeoutSeconds,
    storageDir,
    trace,
  } = options;

  return new Promise((resolve, reject) => {
    let inputData = "";

    process.stdin.on("data", (chunk) => {
      inputData += chunk.toString();
    });

    process.stdin.on("end", async () => {
      try {
        let hookEvent;
        try {
          const jsonData = JSON.parse(inputData);
          hookEvent = parseHookEvent(jsonData);
          if (!hookEvent) {
            throw new Error("Failed to parse hook event");
          }
        } catch (error) {
          logger.error("Failed to parse hook event", error);
          reject(error);
          return;
        }

        logger.info("Parsed hook event", {
          type: hookEvent.hook_event_name,
          sessionId: hookEvent.session_id,
        });

        // Save raw event to storage in trace mode
        if (trace && storageDir) {
          try {
            const storage = createFileStorage({ storageDir });
            await storage.appendEvent(hookEvent.session_id, hookEvent);
            logger.debug("Saved raw event to storage", {
              sessionId: hookEvent.session_id,
              eventType: hookEvent.hook_event_name,
            });
          } catch (error) {
            logger.warn("Failed to save raw event", error);
          }
        }

        const eventType = hookEvent.hook_event_name;

        // For PreToolUse events, don't show progress in transcript
        if (eventType === "PreToolUse") {
          resolve();
          return;
        }

        // Format the event for Slack
        const slackMessage = await formatHookEventForSlack(hookEvent);

        // Check for interactive mode
        const isInteractive = process.stdin.isTTY;
        if (isInteractive && !dryRun) {
          logger.debug(
            "Interactive mode detected - console output will be shown in transcript mode",
          );
        }

        if (dryRun) {
          logger.info("Dry run mode - would send to Slack:", slackMessage);

          // Show all assistant messages in dry-run
          if (hookEvent.transcript_path) {
            try {
              const reader = createTranscriptReader(hookEvent.transcript_path);
              const allSummaries = await reader.getAllAssistantSummaries();

              logger.info(
                `Dry run mode - would send ${allSummaries.length} assistant message(s)`,
              );

              allSummaries.forEach((summary, index) => {
                if (summary.text) {
                  logger.info(`Assistant message ${index + 1}:`, {
                    text:
                      summary.text.substring(0, 200) +
                      (summary.text.length > 200 ? "..." : ""),
                    thinking: summary.thinking
                      ? summary.thinking.substring(0, 100) + "..."
                      : "none",
                    toolUses: summary.toolUses.length,
                    model: summary.model,
                  });
                }
              });
            } catch (error) {
              logger.warn("Failed to read transcript", error);
            }
          }

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
              timeoutSeconds: threadTimeoutSeconds || 3600,
              storageDir,
            },
          );

          // Send the hook event message to Slack
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

          // Send any unsent assistant messages from the transcript
          if (hookEvent.transcript_path && threadTs && storageDir) {
            try {
              await sendUnsentAssistantMessages({
                client: slackClient,
                channel,
                threadTs,
                sessionId: hookEvent.session_id,
                transcriptPath: hookEvent.transcript_path,
                storageDir,
              });
            } catch (error) {
              logger.error("Failed to send assistant messages", error);
            }
          }
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
