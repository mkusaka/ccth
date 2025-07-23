# CCTH - Claude Code to Slack Thread Hook

[![CI](https://github.com/mkusaka/ccth/actions/workflows/ci.yml/badge.svg)](https://github.com/mkusaka/ccth/actions/workflows/ci.yml)

A CLI tool that sends Claude Code session messages to Slack threads. Designed to be used as a hook in Claude Code for real-time session monitoring and collaboration.

![Slack Thread Example](./slack-thread-example.png)

## Features

- 🔄 Real-time session message forwarding to Slack
- 🧵 Automatic thread management per session
- 📝 Rich message formatting with proper context
- 🔧 Configurable via environment variables or CLI options
- 🧪 Comprehensive test coverage
- 🚀 Built with TypeScript for type safety

## Installation

### From npm (recommended)

```bash
npm install -g ccth
# or
pnpm add -g ccth
# or
yarn global add ccth
```

### From source

```bash
# Clone the repository
git clone https://github.com/mkusaka/ccth.git
cd ccth

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Link globally
pnpm link --global
```

## Usage

### As a Claude Code Hook

1. Set up environment variables:

```bash
export SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
export SLACK_CHANNEL="C1234567890"  # Your Slack channel ID
```

2. Configure Claude Code hooks in your settings file (`~/.claude/settings.json` or project-specific `.claude/settings.json`):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ]
  }
}
```

This configuration will:
- Send user prompts to Slack when submitted (`UserPromptSubmit`)
- Send tool execution results to Slack after completion (`PostToolUse`)

Note: `UserPromptSubmit` doesn't require a matcher since it's not tool-specific.

### CLI Options

```bash
ccth [options]

Options:
  -c, --channel <channel>        Slack channel ID or name (env: SLACK_CHANNEL)
  -t, --token <token>           Slack bot token (env: SLACK_BOT_TOKEN)
  -d, --debug                   Enable debug logging
  --dry-run                     Process messages without sending to Slack
  --thread-timeout <seconds>    Thread inactivity timeout in seconds (default: 3600)
  -V, --version                 output the version number
  -h, --help                    display help for command
```

### Example Hook Input

The tool expects Claude Code hook event JSON via stdin:

```bash
# UserPromptSubmit event
echo '{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/home/user/project",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Help me write a function"
}' | ccth

# PostToolUse event
echo '{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/home/user/project",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {"file_path": "/test.txt", "content": "Hello"},
  "tool_response": {"success": true}
}' | ccth

# Dry run mode for testing
echo '{...}' | ccth --dry-run --debug
```

## Slack Bot Setup

1. Create a new Slack App at https://api.slack.com/apps
2. Add OAuth scopes:
   - `chat:write`
   - `chat:write.public` (if posting to public channels)
3. Install the app to your workspace
4. Copy the Bot User OAuth Token

## Development

```bash
# Run in development mode
pnpm run dev

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Type checking
pnpm run typecheck

# Linting
pnpm run lint

# Format code
pnpm run format
```

## Setting up Claude Code

### Quick Start

1. Install ccth globally:
```bash
npm install -g ccth
```

2. Set environment variables:
```bash
export SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
export SLACK_CHANNEL="C1234567890"  # Your Slack channel ID
```

3. Add to Claude Code settings (`~/.claude/settings.json`):
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ]
  }
}
```

See [examples/](examples/) directory for more configuration examples.

## Hook Events Supported

### Core Events (Recommended)

- **UserPromptSubmit**: Captures user prompts when submitted
  - Shows user input with timestamp
  - Essential for tracking conversation flow

- **PostToolUse**: Captures tool execution results
  - Shows tool name, input parameters, and response
  - Helps track what actions Claude is performing

### Additional Events

- **Stop**: Triggered when Claude completes its response
  - Shows session completion status
  - Useful for tracking when Claude finishes tasks
  - Includes `stop_hook_active` flag if stop hook is preventing completion

- **Notification**: System notifications from Claude Code
  - Permission requests (e.g., "Claude needs your permission to use Bash")
  - Idle notifications (e.g., "Claude is waiting for your input")
  - Automatically categorized with appropriate icons (🔐 for permissions, ⏳ for idle)

### Message Formatting

Each event is formatted with:
- Timestamp
- Event-specific icon
- Rich formatting using Slack Block Kit
- Contextual information based on event type

## Thread Management

- Each Claude Code session gets its own Slack thread
- Threads are reused for the same session ID
- Inactive threads expire after the configured timeout (default: 1 hour)
- Thread cleanup runs automatically every 5 minutes

## Configuration

### Environment Variables

- `SLACK_BOT_TOKEN`: Your Slack bot token (required)
- `SLACK_CHANNEL`: Default Slack channel ID (required)

### Hook Configuration Examples

#### Monitor Only Specific Tools
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "ccth --debug"
          }
        ]
      }
    ]
  }
}
```

Note: For `PostToolUse`, if you omit the `matcher` field entirely, it will match all tools.

#### Full Session Monitoring
```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      }
    ]
  }
}
```

This configuration provides:
- **User prompts** via `UserPromptSubmit`
- **Tool executions** via `PostToolUse` 
- **Completion status** via `Stop`
- **Permission requests and idle alerts** via `Notification`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request