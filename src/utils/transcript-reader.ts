import { promises as fs } from "fs";
import { logger } from "./logger.js";
import { SessionMessage } from "../schemas/session-message.schema.js";

export interface AssistantSummary {
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
}

/**
 * Read and parse Claude Code transcript files (JSONL format)
 */
export class TranscriptReader {
  private transcriptPath: string;

  constructor(transcriptPath: string) {
    this.transcriptPath = transcriptPath;
  }

  /**
   * Read the transcript file and parse all messages
   */
  async readMessages(): Promise<SessionMessage[]> {
    try {
      const content = await fs.readFile(this.transcriptPath, "utf-8");
      const lines = content.trim().split("\n");
      const messages: SessionMessage[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line) as SessionMessage;
          messages.push(message);
        } catch (error) {
          logger.warn("Failed to parse transcript line", { line, error });
        }
      }

      return messages;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        logger.debug("Transcript file not found", {
          path: this.transcriptPath,
        });
        return [];
      }
      throw error;
    }
  }

  /**
   * Get the latest assistant message from the transcript
   */
  async getLatestAssistantMessage(): Promise<SessionMessage | null> {
    const messages = await this.readMessages();

    // Find the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message && message.type === "assistant") {
        return message;
      }
    }

    return null;
  }

  /**
   * Get the latest assistant response text
   */
  async getLatestAssistantResponse(): Promise<string | null> {
    const message = await this.getLatestAssistantMessage();
    if (!message || message.type !== "assistant") return null;

    const content = message.message.content;
    if (!Array.isArray(content)) return null;

    // Extract text content
    const textParts: string[] = [];
    for (const item of content) {
      if (item.type === "text" && item.text) {
        textParts.push(item.text);
      }
    }

    return textParts.length > 0 ? textParts.join("\n") : null;
  }

  /**
   * Get all assistant messages from the transcript
   */
  async getAllAssistantMessages(): Promise<SessionMessage[]> {
    const messages = await this.readMessages();
    return messages.filter((msg) => msg && msg.type === "assistant");
  }

  /**
   * Get a summary of the latest assistant message including tool uses
   */
  async getLatestAssistantSummary(): Promise<AssistantSummary | null> {
    const message = await this.getLatestAssistantMessage();
    if (!message || message.type !== "assistant") return null;

    const content = message.message.content;
    if (!Array.isArray(content)) return null;

    const summary: AssistantSummary = {
      text: "",
      toolUses: [],
    };

    // Extract text, thinking, and tool uses
    const textParts: string[] = [];
    const thinkingParts: string[] = [];

    for (const item of content) {
      switch (item.type) {
        case "text":
          if (item.text) {
            textParts.push(item.text);
          }
          break;
        case "thinking":
          if (item.thinking) {
            thinkingParts.push(item.thinking);
          }
          break;
        case "tool_use":
          summary.toolUses.push({
            name: item.name,
            id: item.id,
          });
          break;
      }
    }

    summary.text = textParts.join("\n");
    if (thinkingParts.length > 0) {
      summary.thinking = thinkingParts.join("\n");
    }

    // Add metadata if available
    if ((message as any).metadata) {
      summary.model = (message as any).metadata.model;
    }

    // Add token usage if available
    if (message.message.usage) {
      summary.tokenUsage = {
        input: message.message.usage.input_tokens,
        output: message.message.usage.output_tokens,
      };
    }

    return summary;
  }

  /**
   * Get summaries of all assistant messages including tool uses
   */
  async getAllAssistantSummaries(): Promise<AssistantSummary[]> {
    const messages = await this.getAllAssistantMessages();
    const summaries: AssistantSummary[] = [];

    for (const message of messages) {
      if (message.type !== "assistant") continue;

      const content = message.message.content;
      if (!Array.isArray(content)) continue;

      const summary: AssistantSummary = {
        text: "",
        toolUses: [],
      };

      // Extract text, thinking, and tool uses
      const textParts: string[] = [];
      const thinkingParts: string[] = [];

      for (const item of content) {
        switch (item.type) {
          case "text":
            if (item.text) {
              textParts.push(item.text);
            }
            break;
          case "thinking":
            if (item.thinking) {
              thinkingParts.push(item.thinking);
            }
            break;
          case "tool_use":
            summary.toolUses.push({
              name: item.name,
              id: item.id,
            });
            break;
        }
      }

      summary.text = textParts.join("\n");
      if (thinkingParts.length > 0) {
        summary.thinking = thinkingParts.join("\n");
      }

      // Add metadata if available
      if ((message as any).metadata) {
        summary.model = (message as any).metadata.model;
      }

      // Add token usage if available
      if (message.message.usage) {
        summary.tokenUsage = {
          input: message.message.usage.input_tokens,
          output: message.message.usage.output_tokens,
        };
      }

      summaries.push(summary);
    }

    return summaries;
  }
}

// Helper function to create a reader instance
export function createTranscriptReader(
  transcriptPath: string,
): TranscriptReader {
  return new TranscriptReader(transcriptPath);
}
