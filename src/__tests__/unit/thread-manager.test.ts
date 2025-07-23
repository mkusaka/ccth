import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThreadManager } from '../../slack/thread-manager.js';
import { WebClient } from '@slack/web-api';
import { SessionMessage } from '../../schemas/session-message.schema.js';

describe('ThreadManager', () => {
  let mockClient: WebClient;
  let threadManager: ThreadManager;

  const testMessage: SessionMessage = {
    parentUuid: null,
    isSidechain: false,
    userType: 'external',
    cwd: '/test/dir',
    sessionId: 'test-session-123',
    version: '1.0.0',
    uuid: 'test-uuid-456',
    timestamp: '2024-01-23T12:00:00Z',
    type: 'user',
    message: {
      role: 'user',
      content: 'Hello',
    },
  };

  beforeEach(() => {
    // Mock WebClient
    mockClient = {
      chat: {
        postMessage: vi.fn().mockResolvedValue({
          ok: true,
          ts: '1234567890.123456',
          channel: 'C1234567890',
        }),
      },
    } as unknown as WebClient;

    threadManager = new ThreadManager(mockClient, 'test-channel', 300); // 5 min timeout for tests
  });

  afterEach(() => {
    threadManager.destroy();
    vi.clearAllMocks();
  });

  describe('getOrCreateThread', () => {
    it('should create a new thread for new session', async () => {
      const threadTs = await threadManager.getOrCreateThread('new-session', testMessage);

      expect(threadTs).toBe('1234567890.123456');
      expect(mockClient.chat.postMessage).toHaveBeenCalledOnce();
      expect(mockClient.chat.postMessage).toHaveBeenCalledWith({
        channel: 'test-channel',
        text: 'New Claude Code session started',
        blocks: expect.arrayContaining([
          expect.objectContaining({
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🤖 Claude Code Session',
              emoji: true,
            },
          }),
        ]),
      });
    });

    it('should reuse existing thread for same session', async () => {
      // Create initial thread
      const threadTs1 = await threadManager.getOrCreateThread('session-1', testMessage);
      expect(mockClient.chat.postMessage).toHaveBeenCalledOnce();

      // Reuse thread
      const threadTs2 = await threadManager.getOrCreateThread('session-1', testMessage);

      expect(threadTs1).toBe(threadTs2);
      expect(mockClient.chat.postMessage).toHaveBeenCalledOnce(); // Still only called once
    });

    it('should handle errors when creating thread', async () => {
      vi.mocked(mockClient.chat.postMessage).mockRejectedValueOnce(new Error('API error'));

      await expect(threadManager.getOrCreateThread('error-session', testMessage)).rejects.toThrow(
        'Failed to create thread: API error',
      );
    });

    it('should throw error when client is null', async () => {
      const nullClientManager = new ThreadManager(null, 'test-channel');

      await expect(nullClientManager.getOrCreateThread('session', testMessage)).rejects.toThrow(
        'Slack client not initialized',
      );

      nullClientManager.destroy();
    });
  });

  describe('thread cleanup', () => {
    it('should clean up expired threads', async () => {
      // Create a thread
      await threadManager.getOrCreateThread('old-session', testMessage);

      // Fast-forward time by 6 minutes
      vi.useFakeTimers();
      vi.advanceTimersByTime(6 * 60 * 1000);

      // Trigger cleanup (normally done by interval)
      // @ts-expect-error - accessing private method for testing
      threadManager.cleanupExpiredThreads();

      // Thread should be gone, so new one will be created
      vi.useRealTimers();
      await threadManager.getOrCreateThread('old-session', testMessage);

      expect(mockClient.chat.postMessage).toHaveBeenCalledTimes(2);
    });

    it('should update last activity when reusing thread', async () => {
      await threadManager.getOrCreateThread('active-session', testMessage);

      vi.useFakeTimers();
      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes

      // Use thread again
      await threadManager.getOrCreateThread('active-session', testMessage);

      // Advance another 2 minutes (total 6 minutes from start, but only 2 from last use)
      vi.advanceTimersByTime(2 * 60 * 1000);

      // @ts-expect-error - accessing private method for testing
      threadManager.cleanupExpiredThreads();

      // Thread should still exist
      vi.useRealTimers();
      await threadManager.getOrCreateThread('active-session', testMessage);

      expect(mockClient.chat.postMessage).toHaveBeenCalledOnce(); // Still only the initial call
    });
  });

  describe('destroy', () => {
    it('should clear all threads and stop cleanup interval', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      threadManager.destroy();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
