import { describe, it, expect, vi, beforeEach } from "vitest";
import { processHookInput } from "../../hook-processor.js";
import { createFileStorage } from "../../utils/file-storage.js";
import { WebClient } from "@slack/web-api";

vi.mock("../../utils/file-storage.js", () => ({
  createFileStorage: vi.fn(() => ({
    appendEvent: vi.fn(),
    saveSession: vi.fn(),
    loadSession: vi.fn(),
  })),
}));

vi.mock("../../slack/thread-manager.js", () => ({
  getOrCreateThread: vi.fn().mockResolvedValue("1234567890.123456"),
}));

vi.mock("../../slack/message-formatter.js", () => ({
  formatHookEventForSlack: vi.fn().mockReturnValue({
    text: "Test message",
    blocks: [],
  }),
}));

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Hook Processor - Debug Flag", () => {
  let mockFileStorage: any;
  const mockSlackClient = {
    chat: {
      postMessage: vi.fn().mockResolvedValue({ ts: "123.456" }),
    },
  } as unknown as WebClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFileStorage = {
      appendEvent: vi.fn(),
      saveSession: vi.fn(),
      loadSession: vi.fn(),
    };
    (createFileStorage as any).mockReturnValue(mockFileStorage);
  });

  const simulateHookInput = (hookEvent: any) => {
    // Simulate stdin input
    const originalStdin = process.stdin;
    const mockStdin = {
      setEncoding: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === "data") {
          setTimeout(() => callback(JSON.stringify(hookEvent)), 0);
        } else if (event === "end") {
          setTimeout(() => callback(), 10);
        }
      }),
    };
    Object.defineProperty(process, "stdin", {
      value: mockStdin,
      configurable: true,
    });

    return () => {
      Object.defineProperty(process, "stdin", {
        value: originalStdin,
        configurable: true,
      });
    };
  };

  it("should save raw events when debug is true", async () => {
    const hookEvent = {
      hook_event_name: "UserPromptSubmit",
      session_id: "test-session",
      cwd: "/test",
      transcript_path: "/test/transcript",
      prompt: "Test prompt",
    };

    const cleanup = simulateHookInput(hookEvent);

    await processHookInput({
      slackClient: mockSlackClient,
      channel: "test-channel",
      dryRun: false,
      debug: true,
      storageDir: "/test/storage",
    });

    cleanup();

    expect(mockFileStorage.appendEvent).toHaveBeenCalledWith(
      "test-session",
      hookEvent,
    );
  });

  it("should not save raw events when debug is false", async () => {
    const hookEvent = {
      hook_event_name: "UserPromptSubmit",
      session_id: "test-session",
      cwd: "/test",
      transcript_path: "/test/transcript",
      prompt: "Test prompt",
    };

    const cleanup = simulateHookInput(hookEvent);

    await processHookInput({
      slackClient: mockSlackClient,
      channel: "test-channel",
      dryRun: false,
      debug: false,
    });

    cleanup();

    expect(mockFileStorage.appendEvent).not.toHaveBeenCalled();
  });

  it("should not save raw events in dry-run mode when debug is false", async () => {
    const hookEvent = {
      hook_event_name: "UserPromptSubmit",
      session_id: "test-session",
      cwd: "/test",
      transcript_path: "/test/transcript",
      prompt: "Test prompt",
    };

    const cleanup = simulateHookInput(hookEvent);

    await processHookInput({
      slackClient: null,
      channel: "test-channel",
      dryRun: true,
      debug: false,
    });

    cleanup();

    expect(mockFileStorage.appendEvent).not.toHaveBeenCalled();
  });

  it("should save raw events in dry-run mode when debug is true", async () => {
    const hookEvent = {
      hook_event_name: "UserPromptSubmit",
      session_id: "test-session",
      cwd: "/test",
      transcript_path: "/test/transcript",
      prompt: "Test prompt",
    };

    const cleanup = simulateHookInput(hookEvent);

    await processHookInput({
      slackClient: null,
      channel: "test-channel",
      dryRun: true,
      debug: true,
      storageDir: "/test/storage",
    });

    cleanup();

    expect(mockFileStorage.appendEvent).toHaveBeenCalledWith(
      "test-session",
      hookEvent,
    );
  });
});
