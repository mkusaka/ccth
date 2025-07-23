import { describe, it, expect } from 'vitest';
import { formatMessageForSlack } from '../../slack/message-formatter.js';
import { SessionMessage } from '../../schemas/session-message.schema.js';

describe('Message Formatter', () => {
  const baseMessage = {
    parentUuid: null,
    isSidechain: false,
    userType: 'external' as const,
    cwd: '/test/dir',
    sessionId: 'test-session-123',
    version: '1.0.0',
    uuid: 'test-uuid-456',
    timestamp: '2024-01-23T12:00:00Z',
  };

  describe('formatUserMessage', () => {
    it('should format user message with string content', async () => {
      const message: SessionMessage = {
        ...baseMessage,
        type: 'user',
        message: {
          role: 'user',
          content: 'Hello, Claude!',
        },
      };

      const result = await formatMessageForSlack(message);

      expect(result.text).toBe('User message');
      expect(result.blocks).toBeDefined();
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks![1]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Hello, Claude!',
        },
      });
    });

    it('should format user message with array content', async () => {
      const message: SessionMessage = {
        ...baseMessage,
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'Check this out' },
            { type: 'image', source: { type: 'base64', data: 'abc123', media_type: 'image/png' } },
          ],
        },
      };

      const result = await formatMessageForSlack(message);

      expect(result.blocks).toHaveLength(3);
      expect(result.blocks![1]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Check this out',
        },
      });
      expect(result.blocks![2]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_Image attached_',
        },
      });
    });

    it('should truncate long messages', async () => {
      const longText = 'a'.repeat(4000);
      const message: SessionMessage = {
        ...baseMessage,
        type: 'user',
        message: {
          role: 'user',
          content: longText,
        },
      };

      const result = await formatMessageForSlack(message);
      const textBlock = result.blocks![1] as { text: { text: string } };

      expect(textBlock.text.text).toHaveLength(3000);
      expect(textBlock.text.text).toMatch(/\.\.\.$/);
    });
  });

  describe('formatAssistantMessage', () => {
    it('should format assistant message with text content', async () => {
      const message: SessionMessage = {
        ...baseMessage,
        type: 'assistant',
        message: {
          id: 'msg-123',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-opus',
          content: [{ type: 'text', text: 'I can help you with that!' }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            output_tokens: 50,
          },
        },
      };

      const result = await formatMessageForSlack(message);

      expect(result.blocks).toHaveLength(3);
      expect(result.blocks![0]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: expect.stringContaining('claude-3-opus'),
        },
      });
      expect(result.blocks![2]).toMatchObject({
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Tokens: 100 in / 50 out',
          },
        ],
      });
    });

    it('should format tool use content', async () => {
      const message: SessionMessage = {
        ...baseMessage,
        type: 'assistant',
        message: {
          id: 'msg-123',
          type: 'message',
          role: 'assistant',
          model: 'claude-3-opus',
          content: [
            {
              type: 'tool_use',
              id: 'tool-123',
              name: 'calculator',
              input: { operation: 'add', a: 1, b: 2 },
            },
          ],
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: {
            input_tokens: 100,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
            output_tokens: 50,
          },
        },
      };

      const result = await formatMessageForSlack(message);

      expect(result.blocks).toHaveLength(4);
      expect(result.blocks![1]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🔧 *Tool:* `calculator` (tool-123)',
        },
      });
    });
  });

  describe('formatSystemMessage', () => {
    it('should format system message', async () => {
      const message: SessionMessage = {
        ...baseMessage,
        type: 'system',
        content: 'Session started',
        isMeta: false,
      };

      const result = await formatMessageForSlack(message);

      expect(result.text).toBe('System message');
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks![0]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: expect.stringContaining('ℹ️ *System*'),
        },
      });
    });

    it('should use error emoji for error level', async () => {
      const message: SessionMessage = {
        ...baseMessage,
        type: 'system',
        content: 'An error occurred',
        isMeta: false,
        level: 'error',
      };

      const result = await formatMessageForSlack(message);

      expect(result.blocks![0]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: expect.stringContaining('❌ *System*'),
        },
      });
    });
  });

  describe('formatSummaryMessage', () => {
    it('should format summary message', async () => {
      const message: SessionMessage = {
        ...baseMessage,
        type: 'summary',
        summary: 'This session covered implementing a new feature',
        leafUuid: 'leaf-123',
      };

      const result = await formatMessageForSlack(message);

      expect(result.text).toBe('Session summary');
      expect(result.blocks).toHaveLength(2);
      expect(result.blocks![0]).toMatchObject({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: expect.stringContaining('📋 *Session Summary*'),
        },
      });
    });
  });
});
