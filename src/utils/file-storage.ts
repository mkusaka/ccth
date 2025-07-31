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

export interface EventData {
  timestamp: number;
  event: unknown;
}

interface FileStorageConfig {
  storageDir?: string;
}

// Pure functions
const sanitizeSessionId = (sessionId: string): string =>
  sessionId.replace(/[^a-zA-Z0-9-_]/g, "_");

const getSessionDirPath = (storageDir: string, sessionId: string): string =>
  join(storageDir, sanitizeSessionId(sessionId));

const getSessionFilePath = (storageDir: string, sessionId: string): string =>
  join(getSessionDirPath(storageDir, sessionId), "thread.json");

const getEventsFilePath = (storageDir: string, sessionId: string): string =>
  join(getSessionDirPath(storageDir, sessionId), "events.jsonl");

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
  const sessionDir = getSessionDirPath(storageDir, sessionId);
  await ensureStorageDir(sessionDir);
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
  const sessionDir = getSessionDirPath(storageDir, sessionId);

  try {
    await fs.rm(sessionDir, { recursive: true, force: true });
    logger.debug("Deleted session directory", { sessionId, sessionDir });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      logger.error("Failed to delete session directory", error);
    }
  }
};

export const appendEvent = async (
  sessionId: string,
  event: unknown,
  config: FileStorageConfig = {},
): Promise<void> => {
  const storageDir = config.storageDir || DEFAULT_STORAGE_DIR;
  const sessionDir = getSessionDirPath(storageDir, sessionId);
  await ensureStorageDir(sessionDir);
  const eventsFile = getEventsFilePath(storageDir, sessionId);

  const eventData: EventData = {
    timestamp: Date.now(),
    event,
  };

  try {
    await fs.appendFile(eventsFile, JSON.stringify(eventData) + "\n", "utf-8");
    logger.debug("Appended event to JSONL file", { sessionId, eventsFile });
  } catch (error) {
    throw new Error(
      `Failed to append event: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const cleanupOldSessions = async (
  maxAgeMs: number,
  config: FileStorageConfig = {},
): Promise<void> => {
  const storageDir = config.storageDir || DEFAULT_STORAGE_DIR;

  try {
    await ensureStorageDir(storageDir);
    const entries = await fs.readdir(storageDir, { withFileTypes: true });
    const now = Date.now();

    const cleanupPromises = entries.map(async (entry) => {
      const entryPath = join(storageDir, entry.name);

      // Handle old JSON files (legacy format)
      if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const stats = await fs.stat(entryPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.unlink(entryPath);
            logger.debug("Cleaned up old session file", {
              file: entry.name,
              ageMs: age,
            });
          }
        } catch (error) {
          logger.error("Failed to process file during cleanup", error);
        }
      }

      // Handle new directory format
      if (entry.isDirectory()) {
        try {
          const threadPath = join(entryPath, "thread.json");
          const stats = await fs.stat(threadPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.rm(entryPath, { recursive: true, force: true });
            logger.debug("Cleaned up old session directory", {
              directory: entry.name,
              ageMs: age,
            });
          }
        } catch (error) {
          // If thread.json doesn't exist, check events.jsonl
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            try {
              const eventsPath = join(entryPath, "events.jsonl");
              const stats = await fs.stat(eventsPath);
              const age = now - stats.mtimeMs;

              if (age > maxAgeMs) {
                await fs.rm(entryPath, { recursive: true, force: true });
                logger.debug("Cleaned up old session directory", {
                  directory: entry.name,
                  ageMs: age,
                });
              }
            } catch (innerError) {
              logger.error(
                "Failed to process directory during cleanup",
                innerError,
              );
            }
          } else {
            logger.error("Failed to process directory during cleanup", error);
          }
        }
      }
    });

    await Promise.all(cleanupPromises);
  } catch (error) {
    logger.error("Failed to cleanup old sessions", error);
  }
};

// Migrate old format to new format
export const migrateOldFormat = async (
  config: FileStorageConfig = {},
): Promise<void> => {
  const storageDir = config.storageDir || DEFAULT_STORAGE_DIR;

  try {
    await ensureStorageDir(storageDir);
    const entries = await fs.readdir(storageDir, { withFileTypes: true });

    const migrationPromises = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map(async (entry) => {
        const oldPath = join(storageDir, entry.name);
        const sessionId = entry.name.replace(".json", "");
        const sessionDir = getSessionDirPath(storageDir, sessionId);
        const newPath = join(sessionDir, "thread.json");

        try {
          // Read old file
          const data = await fs.readFile(oldPath, "utf-8");

          // Create new directory structure
          await ensureStorageDir(sessionDir);

          // Write to new location
          await fs.writeFile(newPath, data, "utf-8");

          // Delete old file
          await fs.unlink(oldPath);

          logger.info("Migrated session to new format", {
            sessionId,
            oldPath,
            newPath,
          });
        } catch (error) {
          logger.error("Failed to migrate session", {
            sessionId,
            error,
          });
        }
      });

    await Promise.all(migrationPromises);
  } catch (error) {
    logger.error("Failed to migrate old format", error);
  }
};

// Factory function for creating storage operations with config
export const createFileStorage = (config: FileStorageConfig = {}) => ({
  saveSession: (sessionId: string, data: SessionData) =>
    saveSession(sessionId, data, config),
  loadSession: (sessionId: string) => loadSession(sessionId, config),
  deleteSession: (sessionId: string) => deleteSession(sessionId, config),
  appendEvent: (sessionId: string, event: unknown) =>
    appendEvent(sessionId, event, config),
  cleanupOldSessions: (maxAgeMs: number) =>
    cleanupOldSessions(maxAgeMs, config),
  migrateOldFormat: () => migrateOldFormat(config),
  getStorageDir: () => config.storageDir || DEFAULT_STORAGE_DIR,
});
