import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getOrCreateThread,
  createThreadManager,
} from "../../slack/thread-manager.js";
import { WebClient } from "@slack/web-api";

// Create stable mock functions
const mockSaveSession = vi.fn();
const mockLoadSession = vi.fn();
const mockCleanupOldSessions = vi.fn();

// Mock the file storage module
vi.mock("../../utils/file-storage.js", () => ({
  createFileStorage: vi.fn(() => ({
    saveSession: mockSaveSession,
    loadSession: mockLoadSession,
    deleteSession: vi.fn().mockResolvedValue(undefined),
    cleanupOldSessions: mockCleanupOldSessions,
  })),
}));

describe("Thread Manager (Functional)", () => {
  let mockClient: WebClient;
  const testStorageDir = "/test/storage";

  const testMessage = {
    sessionId: "test-session-123",
    cwd: "/test/dir",
    timestamp: "2024-01-23T12:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockSaveSession.mockResolvedValue(undefined);
    mockLoadSession.mockResolvedValue(null);
    mockCleanupOldSessions.mockResolvedValue(undefined);

    // Mock WebClient
    mockClient = {
      chat: {
        postMessage: vi.fn().mockResolvedValue({
          ok: true,
          ts: "1234567890.123456",
          channel: "C1234567890",
        }),
      },
    } as unknown as WebClient;
  });

  describe("getOrCreateThread", () => {
    it("should create a new thread for new session", async () => {
      const threadTs = await getOrCreateThread("new-session", testMessage, {
        client: mockClient,
        channel: "test-channel",
        storageDir: testStorageDir,
      });

      expect(threadTs).toBe("1234567890.123456");
      expect(mockClient.chat.postMessage).toHaveBeenCalledOnce();
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: "test-channel",
        text: "New Claude Code session started",
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: "header",
            text: {
              type: "plain_text",
              text: "🤖 Claude Code Session",
              emoji: true,
            },
          }),
        ]),
      });

      // Verify session was saved
      expect(mockSaveSession).toHaveBeenCalledWith(
        "new-session",
        expect.objectContaining({
          threadTs: "1234567890.123456",
          sessionId: "new-session",
          channel: "test-channel",
        }),
      );
    });

    it("should reuse existing thread for same session", async () => {
      // Mock existing session in storage
      const existingSession = {
        threadTs: "existing-thread-123",
        lastActivity: Date.now() - 60000, // 1 minute ago
        sessionId: "session-1",
        channel: "test-channel",
      };

      mockLoadSession.mockResolvedValueOnce(existingSession);

      const threadTs = await getOrCreateThread("session-1", testMessage, {
        client: mockClient,
        channel: "test-channel",
        storageDir: testStorageDir,
      });

      expect(threadTs).toBe("existing-thread-123");
      expect(mockClient.chat.postMessage).not.toHaveBeenCalled();

      // Verify session was updated with new lastActivity
      expect(mockSaveSession).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({
          threadTs: "existing-thread-123",
          sessionId: "session-1",
        }),
      );
    });

    it("should throw error when client is null", async () => {
      await expect(
        getOrCreateThread("session", testMessage, {
          client: null,
          channel: "test-channel",
          storageDir: testStorageDir,
        }),
      ).rejects.toThrow("Slack client not initialized");
    });

    it("should handle errors when creating thread", async () => {
      vi.mocked(mockClient.chat.postMessage).mockRejectedValueOnce(
        new Error("API error"),
      );

      await expect(
        getOrCreateThread("error-session", testMessage, {
          client: mockClient,
          channel: "test-channel",
          storageDir: testStorageDir,
        }),
      ).rejects.toThrow("Failed to create thread: API error");
    });
  });

  describe("createThreadManager", () => {
    it("should create thread manager with cleanup functionality", async () => {
      const manager = createThreadManager({
        client: mockClient,
        channel: "test-channel",
        timeoutSeconds: 300,
        storageDir: testStorageDir,
      });

      // Wait for the async cleanup to be called
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify cleanup is called during initialization
      expect(mockCleanupOldSessions).toHaveBeenCalledWith(
        300 * 1000, // 5 minutes in ms
      );

      // Test getOrCreateThread
      const threadTs = await manager.getOrCreateThread(
        "test-session",
        testMessage,
      );
      expect(threadTs).toBe("1234567890.123456");

      // Cleanup
      manager.destroy();
    });

    it("should run cleanup periodically", async () => {
      vi.useFakeTimers();

      const manager = createThreadManager({
        client: mockClient,
        channel: "test-channel",
        timeoutSeconds: 300,
        storageDir: testStorageDir,
      });

      // Wait for initial async operations
      await vi.runOnlyPendingTimersAsync();

      // Clear initial call
      mockCleanupOldSessions.mockClear();

      // Advance time by 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Cleanup should have been called
      expect(mockCleanupOldSessions).toHaveBeenCalledWith(300 * 1000);

      manager.destroy();
      vi.useRealTimers();
    });
  });
});
