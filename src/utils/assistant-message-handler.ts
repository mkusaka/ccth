import { WebClient } from "@slack/web-api";
import { createTranscriptReader } from "./transcript-reader.js";
import { formatAssistantMessage } from "../slack/message-formatter.js";
import { logger } from "./logger.js";
import {
  createSentMessagesStorage,
  hashMessage,
} from "./sent-messages-storage.js";

export interface AssistantMessageHandlerOptions {
  client: WebClient;
  channel: string;
  threadTs: string;
  sessionId: string;
  transcriptPath: string;
  storageDir: string;
}

/**
 * Send all unsent assistant messages from the transcript to Slack
 */
export async function sendUnsentAssistantMessages(
  options: AssistantMessageHandlerOptions,
): Promise<void> {
  const { client, channel, threadTs, sessionId, transcriptPath, storageDir } =
    options;
  const sentMessagesStorage = createSentMessagesStorage(storageDir, sessionId);
  const reader = createTranscriptReader(transcriptPath);

  try {
    // Get all assistant messages from the transcript
    const allMessages = await reader.getAllAssistantMessages();

    for (const message of allMessages) {
      // Create a hash of the message to track if it's been sent
      const messageHash = hashMessage(message);

      // Skip if already sent
      if (await sentMessagesStorage.hasBeenSent(messageHash)) {
        continue;
      }

      // Extract content from the message - only assistant messages have the message property
      if (message.type !== "assistant" || !("message" in message)) continue;

      const content = message.message.content;
      if (!Array.isArray(content)) continue;

      // Check if this message has actual text content (not just tool uses)
      const hasTextContent = content.some(
        (item) =>
          item.type === "text" && item.text && item.text.trim().length > 0,
      );

      // Only send messages with text content
      if (hasTextContent) {
        // Convert to summary format for our formatter
        const summary = {
          text: content
            .filter((item) => item.type === "text" && "text" in item)
            .map((item) => (item as any).text)
            .join("\n"),
          thinking:
            content
              .filter((item) => item.type === "thinking" && "thinking" in item)
              .map((item) => (item as any).thinking)
              .join("\n") || undefined,
          toolUses: content
            .filter(
              (item) =>
                item.type === "tool_use" && "name" in item && "id" in item,
            )
            .map((item) => ({
              name: (item as any).name,
              id: (item as any).id,
            })),
          model: (message as any).message?.model,
          tokenUsage: (message as any).message?.usage
            ? {
                input: (message as any).message.usage.input_tokens,
                output: (message as any).message.usage.output_tokens,
              }
            : undefined,
        };

        const formattedMessage = formatAssistantMessage(summary);

        // Send to Slack
        await client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: `:robot_face: Assistant at ${new Date(message.timestamp).toLocaleTimeString()}`,
          blocks: formattedMessage.blocks,
        });

        // Mark as sent
        await sentMessagesStorage.markAsSent(messageHash);

        logger.debug("Sent assistant message to Slack", {
          sessionId,
          messageHash,
          textLength: summary.text.length,
        });
      }
    }
  } catch (error) {
    logger.error("Failed to send assistant messages", error);
  }
}
