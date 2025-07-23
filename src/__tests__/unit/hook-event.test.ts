import { describe, it, expect } from "vitest";
import {
  HookEventSchema,
  UserPromptSubmitEventSchema,
  PostToolUseEventSchema,
  StopEventSchema,
  NotificationEventSchema,
  parseHookEvent,
} from "../../schemas/hook-event.schema.js";

describe("Hook Event Schema", () => {
  describe("UserPromptSubmitEvent", () => {
    it("should parse valid UserPromptSubmit event", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "UserPromptSubmit",
        prompt: "Help me write a function",
      };

      const result = UserPromptSubmitEventSchema.parse(input);
      expect(result).toEqual(input);
    });

    it("should reject UserPromptSubmit without prompt", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "UserPromptSubmit",
      };

      expect(() => UserPromptSubmitEventSchema.parse(input)).toThrow();
    });
  });

  describe("PostToolUseEvent", () => {
    it("should parse valid PostToolUse event", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/path/to/file.txt",
          content: "Hello, world!",
        },
        tool_response: {
          success: true,
          filePath: "/path/to/file.txt",
        },
      };

      const result = PostToolUseEventSchema.parse(input);
      expect(result).toEqual(input);
    });

    it("should parse PostToolUse with complex tool response", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "PostToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "ls -la",
        },
        tool_response: "drwxr-xr-x  10 user  staff  320 Jan 23 12:00 .",
      };

      const result = PostToolUseEventSchema.parse(input);
      expect(result).toEqual(input);
    });
  });

  describe("StopEvent", () => {
    it("should parse valid Stop event", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "Stop",
        stop_hook_active: true,
      };

      const result = StopEventSchema.parse(input);
      expect(result).toEqual(input);
    });

    it("should parse Stop event without stop_hook_active", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "Stop",
      };

      const result = StopEventSchema.parse(input);
      expect(result).toEqual(input);
    });
  });

  describe("NotificationEvent", () => {
    it("should parse valid Notification event", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "Notification",
        message: "Claude needs your permission to use Bash",
      };

      const result = NotificationEventSchema.parse(input);
      expect(result).toEqual(input);
    });
  });

  describe("HookEventSchema (discriminated union)", () => {
    it("should parse different event types correctly", () => {
      const events = [
        {
          session_id: "test-123",
          transcript_path: "/path/to/transcript.jsonl",
          cwd: "/home/user/project",
          hook_event_name: "UserPromptSubmit",
          prompt: "Hello",
        },
        {
          session_id: "test-123",
          transcript_path: "/path/to/transcript.jsonl",
          cwd: "/home/user/project",
          hook_event_name: "PostToolUse",
          tool_name: "Read",
          tool_input: { file_path: "/test.txt" },
          tool_response: "content",
        },
        {
          session_id: "test-123",
          transcript_path: "/path/to/transcript.jsonl",
          cwd: "/home/user/project",
          hook_event_name: "Stop",
        },
        {
          session_id: "test-123",
          transcript_path: "/path/to/transcript.jsonl",
          cwd: "/home/user/project",
          hook_event_name: "Notification",
          message: "Idle for 60 seconds",
        },
      ];

      for (const event of events) {
        const result = HookEventSchema.parse(event);
        expect(result).toEqual(event);
      }
    });
  });

  describe("parseHookEvent helper", () => {
    it("should return parsed event for valid input", () => {
      const input = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "UserPromptSubmit",
        prompt: "Test prompt",
      };

      const result = parseHookEvent(input);
      expect(result).toEqual(input);
    });

    it("should return null for invalid input", () => {
      const input = {
        invalid: "data",
      };

      const result = parseHookEvent(input);
      expect(result).toBeNull();
    });
  });
});
