import { z } from "zod";

// Common fields for all hook events
const BaseHookEventSchema = z.object({
  session_id: z.string(),
  transcript_path: z.string(),
  cwd: z.string(),
  hook_event_name: z.string(),
});

// UserPromptSubmit hook event
export const UserPromptSubmitEventSchema = BaseHookEventSchema.extend({
  hook_event_name: z.literal("UserPromptSubmit"),
  prompt: z.string(),
});

// PostToolUse hook event
export const PostToolUseEventSchema = BaseHookEventSchema.extend({
  hook_event_name: z.literal("PostToolUse"),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
  tool_response: z.unknown(),
});

// Stop hook event
export const StopEventSchema = BaseHookEventSchema.extend({
  hook_event_name: z.literal("Stop"),
  stop_hook_active: z.boolean().optional(),
});

// SubagentStop hook event
export const SubagentStopEventSchema = BaseHookEventSchema.extend({
  hook_event_name: z.literal("SubagentStop"),
  stop_hook_active: z.boolean().optional(),
});

// Notification hook event
export const NotificationEventSchema = BaseHookEventSchema.extend({
  hook_event_name: z.literal("Notification"),
  message: z.string(),
});

// PreCompact hook event
export const PreCompactEventSchema = BaseHookEventSchema.extend({
  hook_event_name: z.literal("PreCompact"),
  trigger: z.union([z.literal("manual"), z.literal("auto")]),
  custom_instructions: z.string(),
});

// PreToolUse hook event
export const PreToolUseEventSchema = BaseHookEventSchema.extend({
  hook_event_name: z.literal("PreToolUse"),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
});

// Union type for all hook events
export const HookEventSchema = z.discriminatedUnion("hook_event_name", [
  UserPromptSubmitEventSchema,
  PostToolUseEventSchema,
  StopEventSchema,
  SubagentStopEventSchema,
  NotificationEventSchema,
  PreCompactEventSchema,
  PreToolUseEventSchema,
]);

export type HookEvent = z.infer<typeof HookEventSchema>;
export type UserPromptSubmitEvent = z.infer<typeof UserPromptSubmitEventSchema>;
export type PostToolUseEvent = z.infer<typeof PostToolUseEventSchema>;
export type StopEvent = z.infer<typeof StopEventSchema>;
export type NotificationEvent = z.infer<typeof NotificationEventSchema>;

// Helper function to parse hook event with better error handling
export function parseHookEvent(data: unknown): HookEvent | null {
  try {
    return HookEventSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Hook event validation error:", error.issues);
    }
    return null;
  }
}
