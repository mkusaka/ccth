import { promises as fs } from "fs";
import { join } from "path";
import { homedir } from "os";
import { logger } from "./logger.js";

const DEFAULT_STORAGE_DIR = join(homedir(), ".ccth");

export interface SessionData {
  threadTs: string;
  lastActivity: number;
  channel: string;
  sessionId: string;
}

interface FileStorageConfig {
  storageDir?: string;
}

// Pure functions
const sanitizeSessionId = (sessionId: string): string =>
  sessionId.replace(/[^a-zA-Z0-9-_]/g, "_");

const getSessionFilePath = (storageDir: string, sessionId: string): string =>
  join(storageDir, `${sanitizeSessionId(sessionId)}.json`);

// Side-effect functions
export const ensureStorageDir = async (storageDir: string): Promise<void> => {
  try {
    await fs.mkdir(storageDir, { recursive: true });
  } catch (error) {
    throw new Error(
      `Failed to create storage directory: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const saveSession = async (
  sessionId: string,
  data: SessionData,
  config: FileStorageConfig = {},
): Promise<void> => {
  const storageDir = config.storageDir || DEFAULT_STORAGE_DIR;
  await ensureStorageDir(storageDir);
  const filePath = getSessionFilePath(storageDir, sessionId);

  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    logger.debug("Saved session data", { sessionId, filePath });
  } catch (error) {
    throw new Error(
      `Failed to save session data: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const loadSession = async (
  sessionId: string,
  config: FileStorageConfig = {},
): Promise<SessionData | null> => {
  const storageDir = config.storageDir || DEFAULT_STORAGE_DIR;
  const filePath = getSessionFilePath(storageDir, sessionId);

  try {
    const data = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(data) as SessionData;
    logger.debug("Loaded session data", { sessionId, filePath });
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      logger.debug("Session file not found", { sessionId, filePath });
      return null;
    }
    logger.error("Failed to load session data", error);
    return null;
  }
};

export const deleteSession = async (
  sessionId: string,
  config: FileStorageConfig = {},
): Promise<void> => {
  const storageDir = config.storageDir || DEFAULT_STORAGE_DIR;
  const filePath = getSessionFilePath(storageDir, sessionId);

  try {
    await fs.unlink(filePath);
    logger.debug("Deleted session file", { sessionId, filePath });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("Failed to delete session file", error);
    }
  }
};

export const cleanupOldSessions = async (
  maxAgeMs: number,
  config: FileStorageConfig = {},
): Promise<void> => {
  const storageDir = config.storageDir || DEFAULT_STORAGE_DIR;

  try {
    await ensureStorageDir(storageDir);
    const files = await fs.readdir(storageDir);
    const now = Date.now();

    const cleanupPromises = files
      .filter((file) => file.endsWith(".json"))
      .map(async (file) => {
        const filePath = join(storageDir, file);
        try {
          const stats = await fs.stat(filePath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.unlink(filePath);
            logger.debug("Cleaned up old session file", { file, ageMs: age });
          }
        } catch (error) {
          logger.error("Failed to process file during cleanup", error);
        }
      });

    await Promise.all(cleanupPromises);
  } catch (error) {
    logger.error("Failed to cleanup old sessions", error);
  }
};

// Factory function for creating storage operations with config
export const createFileStorage = (config: FileStorageConfig = {}) => ({
  saveSession: (sessionId: string, data: SessionData) =>
    saveSession(sessionId, data, config),
  loadSession: (sessionId: string) => loadSession(sessionId, config),
  deleteSession: (sessionId: string) => deleteSession(sessionId, config),
  cleanupOldSessions: (maxAgeMs: number) =>
    cleanupOldSessions(maxAgeMs, config),
});
