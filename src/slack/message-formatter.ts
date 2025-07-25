import { KnownBlock } from "@slack/types";
import {
  HookEvent,
  UserPromptSubmitEvent,
  PostToolUseEvent,
  StopEvent,
  NotificationEvent,
} from "../schemas/hook-event.schema.js";

// Legacy imports for potential future use with transcript parsing
import { SessionMessage } from "../schemas/session-message.schema.js";
import type { AssistantSummary } from "../utils/transcript-reader.js";

// Format tool input/output for display
const formatToolData = (data: unknown, maxLength = 500): string => {
  try {
    const str = JSON.stringify(data, null, 2);
    if (str.length > maxLength) {
      return str.substring(0, maxLength) + "...";
    }
    return str;
  } catch {
    return String(data);
  }
};

// Format timestamp
const formatTimestamp = (timestamp?: string): string => {
  const date = timestamp ? new Date(timestamp) : new Date();
  return date.toLocaleTimeString();
};

// Format UserPromptSubmit event
const formatUserPromptSubmit = (
  event: UserPromptSubmitEvent,
): { text: string; blocks: KnownBlock[] } => {
  const time = formatTimestamp();
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `👤 *User at ${time}*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          event.prompt.length > 3000
            ? event.prompt.substring(0, 3000) + "..."
            : event.prompt,
      },
    },
    {
      type: "divider",
    },
  ];

  return {
    text: `User: ${event.prompt.substring(0, 100)}...`,
    blocks,
  };
};

// Format PostToolUse event
const formatPostToolUse = (
  event: PostToolUseEvent,
): { text: string; blocks: KnownBlock[] } => {
  const time = formatTimestamp();
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔧 *Tool Use: ${event.tool_name} at ${time}*`,
      },
    },
  ];

  // Add tool input
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Input:*\n\`\`\`${formatToolData(event.tool_input)}\`\`\``,
    },
  });

  // Add tool response
  if (event.tool_response) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Response:*\n\`\`\`${formatToolData(event.tool_response)}\`\`\``,
      },
    });
  }

  blocks.push({
    type: "divider",
  });

  return {
    text: `Tool Use: ${event.tool_name}`,
    blocks,
  };
};

// Format Stop event
const formatStop = (
  event: StopEvent,
): { text: string; blocks: KnownBlock[] } => {
  const time = formatTimestamp();
  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `✅ *Session Completed at ${time}*`,
      },
    },
  ];

  if (event.stop_hook_active) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "⚠️ Stop hook is active",
        },
      ],
    });
  }

  blocks.push({
    type: "divider",
  });

  return {
    text: "Session completed",
    blocks,
  };
};

// Format Notification event
const formatNotification = (
  event: NotificationEvent,
): { text: string; blocks: KnownBlock[] } => {
  const time = formatTimestamp();

  // Determine notification type
  const isPermissionRequest = event.message.includes("permission");
  const isIdle = event.message.includes("waiting");

  const icon = isPermissionRequest ? "🔐" : isIdle ? "⏳" : "ℹ️";
  const header = isPermissionRequest
    ? "Permission Request"
    : isIdle
      ? "Idle Notification"
      : "Notification";

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${icon} *${header} at ${time}*`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: event.message,
      },
    },
    {
      type: "divider",
    },
  ];

  return {
    text: event.message,
    blocks,
  };
};

// Main formatter for hook events
export async function formatHookEventForSlack(
  event: HookEvent,
): Promise<{ text: string; blocks: KnownBlock[] }> {
  switch (event.hook_event_name) {
    case "UserPromptSubmit":
      return formatUserPromptSubmit(event);
    case "PostToolUse":
      return formatPostToolUse(event);
    case "Stop":
      return formatStop(event);
    case "Notification":
      return formatNotification(event);
    default:
      // For other event types, create a generic format
      return {
        text: `${event.hook_event_name} event`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${event.hook_event_name}* at ${formatTimestamp()}`,
            },
          },
          {
            type: "divider",
          },
        ],
      };
  }
}

// Legacy function for SessionMessage (kept for potential future use)
export async function formatMessageForSlack(
  message: SessionMessage,
): Promise<{ text: string; blocks: KnownBlock[] }> {
  const blocks: KnownBlock[] = [];
  const time = formatTimestamp(message.timestamp);

  switch (message.type) {
    case "user": {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `👤 *User at ${time}*`,
        },
      });

      const content = message.message.content;
      if (typeof content === "string") {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              content.length > 3000
                ? content.substring(0, 3000) + "..."
                : content,
          },
        });
      }
      break;
    }

    case "assistant": {
      const model = (message as any).metadata?.model || "unknown";
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🤖 *Assistant at ${time} (${model})*`,
        },
      });

      const content = message.message.content;
      if (Array.isArray(content)) {
        for (const item of content) {
          if (item.type === "text" && item.text) {
            blocks.push({
              type: "section",
              text: {
                type: "mrkdwn",
                text:
                  item.text.length > 3000
                    ? item.text.substring(0, 3000) + "..."
                    : item.text,
              },
            });
          }
        }
      }
      break;
    }

    case "system": {
      const content = (message as any).content || "";
      const isError = content.toLowerCase().includes("error");
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${isError ? "❌" : "ℹ️"} *System at ${time}*`,
        },
      });
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: content,
        },
      });
      break;
    }

    case "summary": {
      const summary = (message as any).summary || "";
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `📋 *Session Summary at ${time}*`,
        },
      });
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: summary,
        },
      });
      break;
    }
  }

  blocks.push({
    type: "divider",
  });

  // Determine text fallback based on message type
  let fallbackText = "Message";
  if (message.type === "user" && message.message.content) {
    fallbackText = String(message.message.content).substring(0, 100) + "...";
  } else if (message.type === "system" && (message as any).content) {
    fallbackText = String((message as any).content).substring(0, 100) + "...";
  } else if (message.type === "summary" && (message as any).summary) {
    fallbackText = String((message as any).summary).substring(0, 100) + "...";
  }

  return {
    text: fallbackText,
    blocks,
  };
}

// Format assistant message for Slack
export function formatAssistantMessage(summary: AssistantSummary): {
  text: string;
  blocks: KnownBlock[];
} {
  const blocks: KnownBlock[] = [];
  const time = new Date().toLocaleTimeString();

  // Header with model info
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `🤖 *Assistant${summary.model ? ` (${summary.model})` : ""} at ${time}*`,
    },
  });

  // Thinking content (if present and not empty)
  if (summary.thinking && summary.thinking.trim()) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `💭 *Thinking...*\n${
          summary.thinking.length > 1500
            ? summary.thinking.substring(0, 1500) + "..."
            : summary.thinking
        }`,
      },
    });
  }

  // Text content
  if (summary.text && summary.text.trim()) {
    const truncatedText =
      summary.text.length > 3000
        ? summary.text.substring(0, 3000) + "..."
        : summary.text;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: truncatedText,
      },
    });
  }

  // Tool uses (if any)
  if (summary.toolUses.length > 0) {
    const toolList = summary.toolUses
      .map((tool) => `• ${tool.name}`)
      .join("\n");
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `🔧 *Tools Used:*\n${toolList}`,
      },
    });
  }

  // Token usage (if available)
  if (summary.tokenUsage) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `📊 Tokens: ${summary.tokenUsage.input} in / ${summary.tokenUsage.output} out`,
        },
      ],
    });
  }

  blocks.push({
    type: "divider",
  });

  // Create fallback text
  const fallbackText = summary.text
    ? summary.text.substring(0, 100) + (summary.text.length > 100 ? "..." : "")
    : "Assistant message";

  return {
    text: fallbackText,
    blocks,
  };
}
