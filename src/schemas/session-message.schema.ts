import { z } from 'zod';
import { ToolResultSchema, TodoItemSchema } from './tool-result-types.schema.js';

// ============================================
// Base Schemas (STRICT)
// ============================================

export const BaseMessageSchema = z
  .object({
    parentUuid: z.string().nullable(),
    isSidechain: z.boolean(),
    userType: z.literal('external'),
    cwd: z.string(),
    sessionId: z.string(),
    version: z.string(),
    uuid: z.string(),
    timestamp: z.string(),
  })
  .strict();

// ============================================
// Content Types (STRICT)
// ============================================

const TextContentSchema = z
  .object({
    type: z.literal('text'),
    text: z.string(),
  })
  .strict();

const ToolUseContentSchema = z
  .object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()), // Tool inputs vary greatly by tool type
  })
  .strict();

const ToolResultContentSchema = z
  .object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z
      .union([
        z.string(),
        z.array(
          z
            .object({
              type: z.literal('text'),
              text: z.string(),
            })
            .strict(),
        ),
        z.array(
          z
            .object({
              type: z.literal('image'),
              source: z
                .object({
                  type: z.literal('base64'),
                  data: z.string(),
                  media_type: z.string(),
                })
                .strict(),
            })
            .strict(),
        ),
      ])
      .optional(), // content can be missing in some cases
    is_error: z.boolean().optional(),
  })
  .strict();

const ThinkingContentSchema = z
  .object({
    type: z.literal('thinking'),
    thinking: z.string(),
    signature: z.string(),
  })
  .strict();

const ImageContentSchema = z
  .object({
    type: z.literal('image'),
    source: z
      .object({
        type: z.literal('base64'),
        media_type: z.string(),
        data: z.string(),
      })
      .strict(),
  })
  .strict();

// Union of all content types
const ContentSchema = z.union([
  TextContentSchema,
  ToolUseContentSchema,
  ToolResultContentSchema,
  ThinkingContentSchema,
  ImageContentSchema,
]);

// ============================================
// Usage Schema (STRICT)
// ============================================

const UsageSchema = z
  .object({
    input_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    output_tokens: z.number(),
    service_tier: z.union([z.literal('standard'), z.null()]).optional(), // Can be missing
    server_tool_use: z
      .object({
        web_search_requests: z.number(),
      })
      .strict()
      .optional(),
  })
  .strict();

// ============================================
// Summary Message (STRICT)
// ============================================

export const SummaryMessageSchema = BaseMessageSchema.extend({
  type: z.literal('summary'),
  summary: z.string(),
  leafUuid: z.string(),
}).strict();

// ============================================
// System Message (STRICT)
// ============================================

export const SystemMessageSchema = BaseMessageSchema.extend({
  type: z.literal('system'),
  content: z.string(),
  isMeta: z.boolean(),
  toolUseID: z.string().optional(),
  level: z.string().optional(),
  gitBranch: z.string().optional(),
  requestId: z.string().optional(),
}).strict();

// ============================================
// User Messages (STRICT)
// ============================================

// User message with string content
export const UserStringMessageSchema = BaseMessageSchema.extend({
  type: z.literal('user'),
  message: z
    .object({
      role: z.literal('user'),
      content: z.string(),
    })
    .strict(),
  gitBranch: z.string().optional(),
  isMeta: z.boolean().optional(), // Found by .strict() validation
  isCompactSummary: z.boolean().optional(), // For summary messages
}).strict();

// User message with array content (text, tool_result, image)
export const UserArrayMessageSchema = BaseMessageSchema.extend({
  type: z.literal('user'),
  message: z
    .object({
      role: z.literal('user'),
      content: z.array(ContentSchema),
    })
    .strict(),
  gitBranch: z.string().optional(),
  isMeta: z.boolean().optional(), // Found by .strict() validation
  isCompactSummary: z.boolean().optional(), // For summary messages
  toolUseResult: z
    .union([
      z.string(),
      z.array(
        z
          .object({
            type: z.literal('text'),
            text: z.string(),
          })
          .strict(),
      ),
      z.array(
        z
          .object({
            type: z.literal('image'),
            source: z
              .object({
                type: z.literal('base64'),
                data: z.string(),
                media_type: z.string(),
              })
              .strict(),
          })
          .strict(),
      ),
      z.array(TodoItemSchema), // Todo array format
      ToolResultSchema, // All tool result patterns
    ])
    .optional(),
}).strict();

// ============================================
// Assistant Messages (STRICT)
// ============================================

export const AssistantMessageSchema = BaseMessageSchema.extend({
  type: z.literal('assistant'),
  message: z
    .object({
      id: z.string(),
      type: z.literal('message'),
      role: z.literal('assistant'),
      model: z.string(),
      content: z.array(ContentSchema),
      stop_reason: z.union([
        z.literal('end_turn'),
        z.literal('tool_use'),
        z.literal('stop_sequence'),
        z.null(),
      ]),
      stop_sequence: z.union([z.string(), z.null()]),
      usage: UsageSchema,
    })
    .strict(),
  requestId: z.string().optional(), // Can be missing in some cases
  gitBranch: z.string().optional(),
  isApiErrorMessage: z.boolean().optional(), // For error messages
}).strict();

// ============================================
// Main Union Type
// ============================================

export const SessionMessageSchema = z.union([
  SummaryMessageSchema,
  SystemMessageSchema,
  UserStringMessageSchema,
  UserArrayMessageSchema,
  AssistantMessageSchema,
]);

export type SessionMessage = z.infer<typeof SessionMessageSchema>;
export type SessionMessageType = SessionMessage['type'];

// ============================================
// Helper Type Guards
// ============================================

export const isUserMessage = (
  msg: SessionMessage,
): msg is z.infer<typeof UserStringMessageSchema> | z.infer<typeof UserArrayMessageSchema> => {
  return msg.type === 'user';
};

export const isAssistantMessage = (
  msg: SessionMessage,
): msg is z.infer<typeof AssistantMessageSchema> => {
  return msg.type === 'assistant';
};

export const isSystemMessage = (
  msg: SessionMessage,
): msg is z.infer<typeof SystemMessageSchema> => {
  return msg.type === 'system';
};

export const isSummaryMessage = (
  msg: SessionMessage,
): msg is z.infer<typeof SummaryMessageSchema> => {
  return msg.type === 'summary';
};

// Content type guards
export const hasStringContent = (msg: any): boolean => {
  return typeof msg.message?.content === 'string';
};

export const hasArrayContent = (msg: any): boolean => {
  return Array.isArray(msg.message?.content);
};

export const hasThinkingContent = (msg: SessionMessage): boolean => {
  if (!isAssistantMessage(msg)) return false;
  return msg.message.content.some((item) => item.type === 'thinking');
};

export const hasToolUseContent = (msg: SessionMessage): boolean => {
  if (!isAssistantMessage(msg)) return false;
  return msg.message.content.some((item) => item.type === 'tool_use');
};

// ============================================
// Parsing Utilities
// ============================================

export const parseSessionMessage = (data: unknown): SessionMessage | null => {
  try {
    return SessionMessageSchema.parse(data);
  } catch (error) {
    console.error('Failed to parse session message:', error);
    return null;
  }
};

export const safeParseSessionMessage = (data: unknown) => {
  return SessionMessageSchema.safeParse(data);
};
