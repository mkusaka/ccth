import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureStorageDir,
  saveSession,
  loadSession,
  deleteSession,
  cleanupOldSessions,
  createFileStorage,
  appendEvent,
  migrateOldFormat,
  SessionData,
} from "../../utils/file-storage.js";
import { promises as fs } from "fs";

vi.mock("fs", () => ({
  promises: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    unlink: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    rm: vi.fn(),
    appendFile: vi.fn(),
  },
}));

vi.mock("os", () => ({
  homedir: () => "/home/user",
}));

describe("File Storage (Functional)", () => {
  const mockFs = fs as any;
  const testConfig = { storageDir: "/test/storage" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ensureStorageDir", () => {
    it("should create storage directory if it doesn't exist", async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);

      await ensureStorageDir("/test/storage");

      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/storage", {
        recursive: true,
      });
    });

    it("should throw error if mkdir fails", async () => {
      mockFs.mkdir.mockRejectedValueOnce(new Error("Permission denied"));

      await expect(ensureStorageDir("/test/storage")).rejects.toThrow(
        "Failed to create storage directory: Permission denied",
      );
    });
  });

  describe("saveSession", () => {
    const sessionData: SessionData = {
      threadTs: "1234567890.123456",
      lastActivity: Date.now(),
      channel: "C1234567890",
      sessionId: "test-session",
    };

    it("should save session data to file", async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      await saveSession("test-session", sessionData, testConfig);

      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/storage/test-session", {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/storage/test-session/thread.json",
        JSON.stringify(sessionData, null, 2),
        "utf-8",
      );
    });

    it("should sanitize session ID", async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      await saveSession("test/../../malicious", sessionData, testConfig);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/storage/test_______malicious/thread.json",
        expect.any(String),
        "utf-8",
      );
    });
  });

  describe("loadSession", () => {
    it("should load session data from file", async () => {
      const sessionData: SessionData = {
        threadTs: "1234567890.123456",
        lastActivity: 1234567890000,
        channel: "C1234567890",
        sessionId: "test-session",
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(sessionData));

      const result = await loadSession("test-session", testConfig);

      expect(result).toEqual(sessionData);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        "/test/storage/test-session/thread.json",
        "utf-8",
      );
    });

    it("should return null if file doesn't exist", async () => {
      const error = new Error("File not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockFs.readFile.mockRejectedValueOnce(error);

      const result = await loadSession("non-existent", testConfig);

      expect(result).toBeNull();
    });

    it("should return null on JSON parse error", async () => {
      mockFs.readFile.mockResolvedValueOnce("invalid json");

      const result = await loadSession("test-session", testConfig);

      expect(result).toBeNull();
    });
  });

  describe("deleteSession", () => {
    it("should delete session directory", async () => {
      mockFs.rm.mockResolvedValueOnce(undefined);

      await deleteSession("test-session", testConfig);

      expect(mockFs.rm).toHaveBeenCalledWith("/test/storage/test-session", {
        recursive: true,
        force: true,
      });
    });

    it("should not throw if directory doesn't exist", async () => {
      const error = new Error("Directory not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockFs.rm.mockRejectedValueOnce(error);

      await expect(
        deleteSession("non-existent", testConfig),
      ).resolves.toBeUndefined();
    });
  });

  describe("cleanupOldSessions", () => {
    it("should delete old session files", async () => {
      const now = Date.now();
      const oldFileStats = { mtimeMs: now - 7200000 }; // 2 hours old
      const newFileStats = { mtimeMs: now - 1800000 }; // 30 minutes old

      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.readdir.mockResolvedValueOnce([
        {
          name: "old-session.json",
          isFile: () => true,
          isDirectory: () => false,
        },
        {
          name: "new-session.json",
          isFile: () => true,
          isDirectory: () => false,
        },
        { name: "not-json.txt", isFile: () => true, isDirectory: () => false },
      ]);
      mockFs.stat
        .mockResolvedValueOnce(oldFileStats)
        .mockResolvedValueOnce(newFileStats);
      mockFs.unlink.mockResolvedValue(undefined);

      await cleanupOldSessions(3600000, testConfig); // 1 hour

      expect(mockFs.unlink).toHaveBeenCalledOnce();
      expect(mockFs.unlink).toHaveBeenCalledWith(
        "/test/storage/old-session.json",
      );
    });

    it("should handle errors gracefully", async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.readdir.mockRejectedValueOnce(new Error("Read error"));

      await expect(
        cleanupOldSessions(3600000, testConfig),
      ).resolves.toBeUndefined();
    });
  });

  describe("appendEvent", () => {
    it("should append event to JSONL file", async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.appendFile.mockResolvedValueOnce(undefined);

      const event = { type: "test", data: "example" };
      await appendEvent("test-session", event, testConfig);

      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/storage/test-session", {
        recursive: true,
      });
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        "/test/storage/test-session/events.jsonl",
        expect.stringContaining('"type":"test"'),
        "utf-8",
      );
    });
  });

  describe("migrateOldFormat", () => {
    it("should migrate old JSON files to new directory structure", async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.readdir.mockResolvedValueOnce([
        { name: "session1.json", isFile: () => true, isDirectory: () => false },
        { name: "session2.json", isFile: () => true, isDirectory: () => false },
        { name: "existing-dir", isFile: () => false, isDirectory: () => true },
      ]);

      const sessionData = {
        threadTs: "123",
        lastActivity: Date.now(),
        channel: "C123",
        sessionId: "session1",
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(sessionData));
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.unlink.mockResolvedValue(undefined);

      await migrateOldFormat(testConfig);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        "/test/storage/session1.json",
        "utf-8",
      );
      expect(mockFs.readFile).toHaveBeenCalledWith(
        "/test/storage/session2.json",
        "utf-8",
      );
      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/storage/session1", {
        recursive: true,
      });
      expect(mockFs.mkdir).toHaveBeenCalledWith("/test/storage/session2", {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/storage/session1/thread.json",
        expect.any(String),
        "utf-8",
      );
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/storage/session2/thread.json",
        expect.any(String),
        "utf-8",
      );
      expect(mockFs.unlink).toHaveBeenCalledWith("/test/storage/session1.json");
      expect(mockFs.unlink).toHaveBeenCalledWith("/test/storage/session2.json");
    });
  });

  describe("createFileStorage", () => {
    it("should create storage operations with config", async () => {
      const storage = createFileStorage(testConfig);

      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      const sessionData: SessionData = {
        threadTs: "123",
        lastActivity: Date.now(),
        channel: "C123",
        sessionId: "test",
      };

      await storage.saveSession("test", sessionData);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/storage/test/thread.json",
        expect.any(String),
        "utf-8",
      );
    });
  });
});
