import { z } from "zod";

// ============================================
// Common Types (STRICT)
// ============================================

// Todo item schema
export const TodoItemSchema = z
  .object({
    content: z.string(),
    status: z.enum(["pending", "in_progress", "completed"]),
    priority: z.enum(["high", "medium", "low"]),
    id: z.string(),
  })
  .strict();

// Structured patch schema
export const StructuredPatchItemSchema = z
  .object({
    oldStart: z.number(),
    oldLines: z.number(),
    newStart: z.number(),
    newLines: z.number(),
    lines: z.array(z.string()),
  })
  .strict();

// Edit item schema (for MultiEdit)
const EditItemSchema = z
  .object({
    old_string: z.string(),
    new_string: z.string(),
    replace_all: z.boolean().optional(),
  })
  .strict();

// File info schema
const FileInfoSchema = z
  .object({
    filePath: z.string(),
    content: z.string().optional(),
    base64: z.string().optional(),
    type: z.string().optional(),
    numLines: z.number().optional(),
    totalLines: z.number().optional(),
    startLine: z.number().optional(),
    originalSize: z.number().optional(),
  })
  .strict();

// Usage schema (from Task pattern)
const TaskUsageSchema = z
  .object({
    input_tokens: z.number(),
    cache_creation_input_tokens: z.number(),
    cache_read_input_tokens: z.number(),
    output_tokens: z.number(),
    service_tier: z.literal("standard").optional(),
    server_tool_use: z
      .object({
        web_search_requests: z.number(),
      })
      .strict()
      .optional(),
  })
  .strict();

// ============================================
// Tool Result Patterns (based on analysis)
// ============================================

// 1. Bash Result (26.85%)
const BashResultSchema = z
  .object({
    stdout: z.string(),
    stderr: z.string(),
    interrupted: z.boolean(),
    isImage: z.boolean(),
  })
  .strict();

// 2. File Read Result (23.26%)
const FileReadResultSchema = z
  .object({
    type: z.literal("text"),
    file: FileInfoSchema,
  })
  .strict();

// 3. Edit File Result (15.97%)
const EditFileResultSchema = z
  .object({
    filePath: z.string(),
    oldString: z.string(),
    newString: z.string(),
    originalFile: z.string(),
    structuredPatch: z.array(StructuredPatchItemSchema),
    userModified: z.boolean(),
    replaceAll: z.boolean(),
  })
  .strict();

// 4. Todo Update Result (12.36%)
const TodoUpdateResultSchema = z
  .object({
    oldTodos: z.array(TodoItemSchema),
    newTodos: z.array(TodoItemSchema),
  })
  .strict();

// 5. Create File Result (5.21%)
const CreateFileResultSchema = z
  .object({
    type: z.literal("create"),
    filePath: z.string(),
    content: z.string(),
    structuredPatch: z.array(StructuredPatchItemSchema),
  })
  .strict();

// 6. Multi-edit Result (3.33%)
const MultiEditResultSchema = z
  .object({
    filePath: z.string(),
    edits: z.array(EditItemSchema),
    originalFileContents: z.string(),
    structuredPatch: z.array(StructuredPatchItemSchema),
    userModified: z.boolean(),
  })
  .strict();

// 7. Glob Result (3.32%)
const GlobResultSchema = z
  .object({
    filenames: z.array(z.string()),
    durationMs: z.number(),
    numFiles: z.number(),
    truncated: z.boolean(),
  })
  .strict();

// 8. Grep Result (3.26%)
const GrepResultSchema = z
  .object({
    mode: z.enum(["content", "files_with_matches", "count"]),
    filenames: z.array(z.string()),
    numFiles: z.number(),
    content: z.string().optional(),
    numLines: z.number().optional(),
    numMatches: z.number().optional(),
  })
  .strict();

// 9. Task Completion Result (1.49%)
const TaskResultSchema = z
  .object({
    content: z.array(
      z
        .object({
          type: z.literal("text"),
          text: z.string(),
        })
        .strict(),
    ),
    totalDurationMs: z.number(),
    totalTokens: z.number(),
    totalToolUseCount: z.number(),
    usage: TaskUsageSchema,
    wasInterrupted: z.boolean(),
  })
  .strict();

// 10. WebSearch Result (0.71%)
const WebSearchResultSchema = z
  .object({
    query: z.string(),
    results: z.array(
      z.union([
        z.string(),
        z
          .object({
            tool_use_id: z.string(),
            content: z.array(
              z
                .object({
                  title: z.string(),
                  url: z.string(),
                })
                .strict(),
            ),
          })
          .strict(),
      ]),
    ),
    durationSeconds: z.number(),
  })
  .strict();

// 11. WebFetch Result (0.42%)
const WebFetchResultSchema = z
  .object({
    bytes: z.number(),
    code: z.number(),
    codeText: z.string(),
    result: z.string(),
    durationMs: z.number(),
    url: z.string(),
  })
  .strict();

// 12. Bash with Return Code (0.28%)
const BashWithReturnCodeSchema = z
  .object({
    stdout: z.string(),
    stderr: z.string(),
    interrupted: z.boolean(),
    isImage: z.boolean(),
    returnCodeInterpretation: z.string(),
  })
  .strict();

// 13. Simple filenames pattern
const SimpleFilenamesResultSchema = z
  .object({
    filenames: z.array(z.string()),
    numFiles: z.number(),
  })
  .strict();

// 14. Image type (rare edge case)
const ImageResultSchema = z
  .object({
    type: z.literal("image"),
    // Add other fields if needed based on actual data
  })
  .strict();

// 15. Update File Result (found in validation)
const UpdateFileResultSchema = z
  .object({
    type: z.literal("update"),
    filePath: z.string(),
    content: z.string(),
    structuredPatch: z.array(StructuredPatchItemSchema),
  })
  .strict();

// 16. File info with special image content
const FileResultSchema = z
  .object({
    file: z
      .object({
        type: z.literal("image"),
        source: z
          .object({
            type: z.literal("base64"),
            data: z.string(),
            media_type: z.string(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

// 17. Image with file info (edge case)
const ImageWithFileSchema = z
  .object({
    type: z.literal("image"),
    file: z
      .object({
        base64: z.string(),
        type: z.string(),
        originalSize: z.number(),
      })
      .strict(),
  })
  .strict();

// ============================================
// Export schemas
// ============================================

// Union of all tool result types
export const ToolResultSchema = z.union([
  BashResultSchema,
  BashWithReturnCodeSchema,
  FileReadResultSchema,
  EditFileResultSchema,
  TodoUpdateResultSchema,
  CreateFileResultSchema,
  MultiEditResultSchema,
  GlobResultSchema,
  GrepResultSchema,
  TaskResultSchema,
  WebSearchResultSchema,
  WebFetchResultSchema,
  SimpleFilenamesResultSchema,
  ImageResultSchema,
  UpdateFileResultSchema,
  FileResultSchema,
  ImageWithFileSchema,
]);

// Type exports
export type ToolResult = z.infer<typeof ToolResultSchema>;
export type TodoItem = z.infer<typeof TodoItemSchema>;
export type StructuredPatchItem = z.infer<typeof StructuredPatchItemSchema>;
