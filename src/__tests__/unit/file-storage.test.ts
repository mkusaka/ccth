import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ensureStorageDir,
  saveSession,
  loadSession,
  deleteSession,
  cleanupOldSessions,
  createFileStorage,
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

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/storage/test-session.json",
        JSON.stringify(sessionData, null, 2),
        "utf-8",
      );
    });

    it("should sanitize session ID", async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      await saveSession("test/../../malicious", sessionData, testConfig);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        "/test/storage/test_______malicious.json",
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
        "/test/storage/test-session.json",
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
    it("should delete session file", async () => {
      mockFs.unlink.mockResolvedValueOnce(undefined);

      await deleteSession("test-session", testConfig);

      expect(mockFs.unlink).toHaveBeenCalledWith(
        "/test/storage/test-session.json",
      );
    });

    it("should not throw if file doesn't exist", async () => {
      const error = new Error("File not found") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      mockFs.unlink.mockRejectedValueOnce(error);

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
        "old-session.json",
        "new-session.json",
        "not-json.txt",
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
        "/test/storage/test.json",
        expect.any(String),
        "utf-8",
      );
    });
  });
});
