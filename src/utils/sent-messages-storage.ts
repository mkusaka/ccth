import { promises as fs } from "fs";
import { join } from "path";
import { logger } from "./logger.js";
import { createHash } from "crypto";

export interface SentMessage {
  uuid: string;
  timestamp: number;
  messageHash?: string; // 後方互換性のため残す
}

/**
 * File-based storage for tracking sent messages
 */
export class SentMessagesStorage {
  private storageDir: string;
  private sessionId: string;

  constructor(storageDir: string, sessionId: string) {
    this.storageDir = storageDir;
    this.sessionId = sessionId;
  }

  private get filePath(): string {
    return join(this.storageDir, this.sessionId, "sent-messages.json");
  }

  async loadSentMessages(): Promise<Set<string>> {
    try {
      const content = await fs.readFile(this.filePath, "utf-8");
      const messages: SentMessage[] = JSON.parse(content);
      return new Set(messages.map((m) => m.messageHash).filter((hash): hash is string => hash !== undefined));
    } catch (error) {
      // File doesn't exist yet, return empty set
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return new Set();
      }
      logger.error("Failed to load sent messages", error);
      return new Set();
    }
  }

  async saveSentMessages(messages: Set<string>): Promise<void> {
    try {
      const sessionDir = join(this.storageDir, this.sessionId);
      await fs.mkdir(sessionDir, { recursive: true });

      const sentMessages: SentMessage[] = Array.from(messages).map((hash) => ({
        uuid: hash, // Use hash as uuid for now
        messageHash: hash,
        timestamp: Date.now(),
      }));

      await fs.writeFile(
        this.filePath,
        JSON.stringify(sentMessages, null, 2),
        "utf-8",
      );
    } catch (error) {
      logger.error("Failed to save sent messages", error);
    }
  }

  async markAsSent(messageHash: string): Promise<void> {
    const messages = await this.loadSentMessages();
    messages.add(messageHash);
    await this.saveSentMessages(messages);
  }

  async hasBeenSent(messageHash: string): Promise<boolean> {
    const messages = await this.loadSentMessages();
    return messages.has(messageHash);
  }
}

/**
 * Create a hash of message content for tracking
 */
export function hashMessage(content: any): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(content));
  return hash.digest("hex");
}

/**
 * Create a sent messages storage instance
 */
export function createSentMessagesStorage(
  storageDir: string,
  sessionId: string,
): SentMessagesStorage {
  return new SentMessagesStorage(storageDir, sessionId);
}
