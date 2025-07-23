import { describe, it, expect } from "vitest";
import { formatHookEventForSlack } from "../../slack/message-formatter.js";
import {
  UserPromptSubmitEvent,
  PostToolUseEvent,
  StopEvent,
  NotificationEvent,
} from "../../schemas/hook-event.schema.js";

describe("Hook Event Message Formatter", () => {
  describe("formatHookEventForSlack", () => {
    it("should format UserPromptSubmit event", async () => {
      const event: UserPromptSubmitEvent = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "UserPromptSubmit",
        prompt: "Help me write a function to calculate factorial",
      };

      const result = await formatHookEventForSlack(event);

      expect(result.text).toContain("User:");
      expect(result.blocks).toHaveLength(3); // header, content, divider
      expect(result.blocks[0]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("👤 *User at"),
        },
      });
      expect(result.blocks[1]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Help me write a function to calculate factorial",
        },
      });
    });

    it("should format PostToolUse event", async () => {
      const event: PostToolUseEvent = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "PostToolUse",
        tool_name: "Write",
        tool_input: {
          file_path: "/test.txt",
          content: "Hello, world!",
        },
        tool_response: {
          success: true,
          filePath: "/test.txt",
        },
      };

      const result = await formatHookEventForSlack(event);

      expect(result.text).toBe("Tool Use: Write");
      expect(result.blocks[0]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("🔧 *Tool Use: Write at"),
        },
      });
      expect(result.blocks[1]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("*Input:*"),
        },
      });
      expect(result.blocks[2]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("*Response:*"),
        },
      });
    });

    it("should format Stop event", async () => {
      const event: StopEvent = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "Stop",
        stop_hook_active: true,
      };

      const result = await formatHookEventForSlack(event);

      expect(result.text).toBe("Session completed");
      expect(result.blocks[0]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("✅ *Session Completed at"),
        },
      });
      expect(result.blocks[1]).toMatchObject({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "⚠️ Stop hook is active",
          },
        ],
      });
    });

    it("should format Notification event - permission request", async () => {
      const event: NotificationEvent = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "Notification",
        message: "Claude needs your permission to use Bash",
      };

      const result = await formatHookEventForSlack(event);

      expect(result.text).toBe("Claude needs your permission to use Bash");
      expect(result.blocks[0]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("🔐 *Permission Request at"),
        },
      });
    });

    it("should format Notification event - idle", async () => {
      const event: NotificationEvent = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "Notification",
        message: "Claude is waiting for your input",
      };

      const result = await formatHookEventForSlack(event);

      expect(result.text).toBe("Claude is waiting for your input");
      expect(result.blocks[0]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("⏳ *Idle Notification at"),
        },
      });
    });

    it("should handle long prompts by truncating", async () => {
      const longPrompt = "a".repeat(4000);
      const event: UserPromptSubmitEvent = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "UserPromptSubmit",
        prompt: longPrompt,
      };

      const result = await formatHookEventForSlack(event);

      const contentBlock = result.blocks[1] as any;
      expect(contentBlock.text.text).toHaveLength(3003); // 3000 + "..."
      expect(contentBlock.text.text).toEndWith("...");
    });

    it("should handle unknown event types gracefully", async () => {
      const event = {
        session_id: "test-123",
        transcript_path: "/path/to/transcript.jsonl",
        cwd: "/home/user/project",
        hook_event_name: "PreCompact",
        trigger: "manual",
        custom_instructions: "",
      } as any;

      const result = await formatHookEventForSlack(event);

      expect(result.text).toBe("PreCompact event");
      expect(result.blocks[0]).toMatchObject({
        type: "section",
        text: {
          type: "mrkdwn",
          text: expect.stringContaining("*PreCompact* at"),
        },
      });
    });
  });
});
