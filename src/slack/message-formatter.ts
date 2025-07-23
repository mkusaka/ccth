import {
  SessionMessage,
  isUserMessage,
  isAssistantMessage,
  isSystemMessage,
  isSummaryMessage,
  hasStringContent,
  hasArrayContent,
} from '../schemas/session-message.schema.js';
import { logger } from '../utils/logger.js';

interface SlackMessage {
  text: string;
  blocks?: Array<Record<string, unknown>>;
  mrkdwn?: boolean;
}

export async function formatMessageForSlack(message: SessionMessage): Promise<SlackMessage> {
  logger.debug('Formatting message for Slack', { type: message.type });

  if (isUserMessage(message)) {
    return formatUserMessage(message);
  } else if (isAssistantMessage(message)) {
    return formatAssistantMessage(message);
  } else if (isSystemMessage(message)) {
    return formatSystemMessage(message);
  } else if (isSummaryMessage(message)) {
    return formatSummaryMessage(message);
  }

  // Fallback for unknown message types
  return {
    text: `Unknown message type: ${(message as SessionMessage).type}`,
  };
}

function formatUserMessage(message: SessionMessage): SlackMessage {
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  if (!isUserMessage(message)) {
    return { text: 'Invalid user message format' };
  }

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*User* at ${timestamp}`,
      },
    },
  ];

  if (hasStringContent(message)) {
    const content = message.message.content as string;
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: truncateText(content, 3000),
      },
    });
  } else if (hasArrayContent(message)) {
    const content = message.message.content as Array<{ type: string; text?: string }>;
    for (const item of content) {
      if (item.type === 'text' && item.text) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: truncateText(item.text, 3000),
          },
        });
      } else if (item.type === 'tool_result') {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `_Tool result returned_`,
          },
        });
      } else if (item.type === 'image') {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `_Image attached_`,
          },
        });
      }
    }
  }

  return {
    text: 'User message',
    blocks,
  };
}

function formatAssistantMessage(message: SessionMessage): SlackMessage {
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  if (!isAssistantMessage(message)) {
    return { text: 'Invalid assistant message format' };
  }

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Assistant* at ${timestamp} (${message.message.model})`,
      },
    },
  ];

  // Process content array
  for (const content of message.message.content) {
    if (content.type === 'text') {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: truncateText(content.text, 3000),
        },
      });
    } else if (content.type === 'tool_use') {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🔧 *Tool:* \`${content.name}\` (${content.id})`,
        },
      });

      // Add tool input preview
      const inputPreview = JSON.stringify(content.input, null, 2);
      if (inputPreview.length <= 500) {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `\`\`\`${inputPreview}\`\`\``,
          },
        });
      }
    } else if (content.type === 'thinking') {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `💭 _Thinking..._`,
        },
      });
    }
  }

  // Add usage info if available
  if (message.message.usage) {
    const usage = message.message.usage;
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Tokens: ${usage.input_tokens} in / ${usage.output_tokens} out`,
        },
      ],
    });
  }

  return {
    text: 'Assistant message',
    blocks,
  };
}

function formatSystemMessage(message: SessionMessage): SlackMessage {
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  if (!isSystemMessage(message)) {
    return { text: 'Invalid system message format' };
  }

  const emoji = message.level === 'error' ? '❌' : 'ℹ️';

  return {
    text: 'System message',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${emoji} *System* at ${timestamp}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: truncateText(message.content, 3000),
        },
      },
    ],
  };
}

function formatSummaryMessage(message: SessionMessage): SlackMessage {
  const timestamp = new Date(message.timestamp).toLocaleTimeString();

  if (!isSummaryMessage(message)) {
    return { text: 'Invalid summary message format' };
  }

  return {
    text: 'Session summary',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `📋 *Session Summary* at ${timestamp}`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: truncateText(message.summary, 3000),
        },
      },
    ],
  };
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - 3) + '...';
}
