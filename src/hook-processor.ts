import { parseHookEvent } from "./schemas/hook-event.schema.js";
import { WebClient } from "@slack/web-api";
import { getOrCreateThread } from "./slack/thread-manager.js";
import { formatHookEventForSlack } from "./slack/message-formatter.js";
import { logger } from "./utils/logger.js";
import { createTranscriptReader } from "./utils/transcript-reader.js";
import { KnownBlock } from "@slack/types";
import { createFileStorage } from "./utils/file-storage.js";

interface ProcessOptions {
  slackClient: WebClient | null;
  channel: string;
  dryRun: boolean;
  threadTimeoutSeconds?: number;
  storageDir?: string;
  debug: boolean;
}

export async function processHookInput(options: ProcessOptions): Promise<void> {
  const {
    slackClient,
    channel,
    dryRun,
    threadTimeoutSeconds,
    storageDir,
    debug,
  } = options;

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

        // Save raw event to JSONL file (only in debug mode)
        if (debug) {
          try {
            // Parse just to get session_id
            const rawData = JSON.parse(inputBuffer);
            if (
              rawData &&
              typeof rawData === "object" &&
              "session_id" in rawData
            ) {
              const fileStorage = createFileStorage({ storageDir });
              await fileStorage.appendEvent(
                rawData.session_id as string,
                rawData,
              );
              logger.debug("Saved raw event to storage", {
                sessionId: rawData.session_id,
                eventType: rawData.hook_event_name,
              });
            }
          } catch (error) {
            logger.warn("Failed to save raw event", {
              error,
              inputBuffer,
            });
          }
        }

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

          // For Stop events, also show assistant response in dry-run
          if (
            hookEvent.hook_event_name === "Stop" &&
            hookEvent.transcript_path
          ) {
            try {
              const reader = createTranscriptReader(hookEvent.transcript_path);
              const assistantSummary = await reader.getLatestAssistantSummary();
              if (assistantSummary && assistantSummary.text) {
                logger.info(
                  "Dry run mode - would also send assistant response:",
                  {
                    text: assistantSummary.text.substring(0, 200) + "...",
                    thinking: assistantSummary.thinking
                      ? assistantSummary.thinking.substring(0, 100) + "..."
                      : "none",
                    toolUses: assistantSummary.toolUses.length,
                    model: assistantSummary.model,
                  },
                );

                // Assistant response is not saved as raw event (only hook events)

                // Log the actual formatted message
                const formattedMessage =
                  formatAssistantResponseForSlack(assistantSummary);
                logger.debug("Formatted assistant message:", formattedMessage);
              }
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

          // For Stop events, also send the assistant response
          if (
            hookEvent.hook_event_name === "Stop" &&
            hookEvent.transcript_path
          ) {
            try {
              const reader = createTranscriptReader(hookEvent.transcript_path);
              const assistantSummary = await reader.getLatestAssistantSummary();

              if (assistantSummary && assistantSummary.text) {
                // Assistant response is not saved as raw event (only hook events)

                // Format assistant response for Slack
                const assistantMessage =
                  formatAssistantResponseForSlack(assistantSummary);

                // Send assistant response to Slack
                const assistantResult = await slackClient.chat.postMessage({
                  channel,
                  thread_ts: threadTs,
                  ...assistantMessage,
                });

                logger.info("Assistant response sent to Slack", {
                  ts: assistantResult.ts,
                });
              }
            } catch (error) {
              logger.error("Failed to read/send assistant response", error);
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

// Format assistant response from transcript
function formatAssistantResponseForSlack(summary: {
  text: string;
  thinking?: string;
  toolUses: Array<{
    name: string;
    id: string;
  }>;
  tokenUsage?: {
    input: number;
    output: number;
  };
  model?: string;
}): { text: string; blocks: KnownBlock[] } {
  const blocks: KnownBlock[] = [];
  const time = new Date().toLocaleTimeString();

  // Header with model info
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `🤖 *Assistant Response${summary.model ? ` (${summary.model})` : ""} at ${time}*`,
    },
  });

  // Thinking content (if present)
  if (summary.thinking) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `✻ *Thinking...*\n${summary.thinking.length > 1500 ? summary.thinking.substring(0, 1500) + "..." : summary.thinking}`,
      },
    });
  }

  // Text content
  if (summary.text) {
    const truncatedText =
      summary.text.length > 3000
        ? summary.text.substring(0, 3000) + "..."
        : summary.text;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: truncatedText,
      },
    });
  }

  // Tool uses
  if (summary.toolUses.length > 0) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🔧 Used tools: ${summary.toolUses.map((t) => t.name).join(", ")}`,
        },
      ],
    });
  }

  // Token usage if present
  if (summary.tokenUsage) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📊 Tokens: ${summary.tokenUsage.input.toLocaleString()} in / ${summary.tokenUsage.output.toLocaleString()} out`,
        },
      ],
    });
  }

  blocks.push({
    type: "divider",
  });

  return {
    text: `Assistant: ${summary.text.substring(0, 100)}...`,
    blocks,
  };
}
