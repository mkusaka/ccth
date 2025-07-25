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
  -d, --debug                   Enable debug logging and event storage
  --dry-run                     Process messages without sending to Slack
  --thread-timeout <seconds>    Thread inactivity timeout in seconds (default: 3600)
  -V, --version                 output the version number
  -h, --help                    display help for command
```

### Debug Mode and Event Logging

When running with the `-d, --debug` flag, ccth will save raw hook events to disk for debugging purposes:

```
~/.ccth/
  └── {session_id}/
      ├── thread.json    # Session metadata
      └── events.jsonl   # Raw hook events in chronological order
```

This is useful for debugging and analyzing Claude Code session activity.

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

### Step 1: Create a Slack App

1. Go to [Slack API Apps page](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Enter:
   - **App Name**: `CCTH Bot` (or your preferred name)
   - **Pick a workspace**: Select your Slack workspace
5. Click **"Create App"**

### Step 2: Configure Bot Token Scopes

1. In your app's dashboard, navigate to **"OAuth & Permissions"** in the left sidebar
2. Scroll down to **"Scopes"** section
3. Under **"Bot Token Scopes"**, click **"Add an OAuth Scope"**
4. Add the following scopes:
   - `chat:write` - Required for sending messages
   - `chat:write.public` - Required if posting to public channels
   - `channels:read` - Optional: To list channels
   - `groups:read` - Optional: To access private channels
5. Save your changes

### Step 3: Install App to Workspace

1. Scroll to the top of the **"OAuth & Permissions"** page
2. Click **"Install to Workspace"**
3. Review the permissions and click **"Allow"**
4. You'll be redirected back to the OAuth & Permissions page

### Step 4: Copy Bot Token

1. After installation, you'll see a **"Bot User OAuth Token"** starting with `xoxb-`
2. Click **"Copy"** to copy the token
3. Save this token securely - you'll need it for the `SLACK_BOT_TOKEN` environment variable

### Step 5: Find Your Channel ID

#### Method 1: From Slack App
1. Right-click on the channel name in Slack
2. Select **"View channel details"**
3. Scroll to the bottom
4. The Channel ID starts with `C` (e.g., `C1234567890`)

#### Method 2: From Slack Web
1. Open Slack in your browser
2. Navigate to the channel
3. The URL will contain the channel ID: `https://app.slack.com/client/T[TEAM_ID]/C[CHANNEL_ID]`

### Step 6: Add Bot to Channel

1. In Slack, go to the channel where you want the bot to post
2. Type `/invite @CCTH Bot` (or your bot's name)
3. Press Enter to invite the bot

### Step 7: Set Environment Variables

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)
export SLACK_BOT_TOKEN="xoxb-your-bot-token-here"
export SLACK_CHANNEL="C1234567890"  # Your channel ID

# Or create a .env file in your project
echo 'SLACK_BOT_TOKEN="xoxb-your-bot-token-here"' >> ~/.env
echo 'SLACK_CHANNEL="C1234567890"' >> ~/.env
```

### Troubleshooting

#### Bot can't post to channel
- Ensure the bot is invited to the channel
- For private channels, the bot needs to be a member
- Check that you have the correct channel ID

#### Invalid token error
- Verify the token starts with `xoxb-`
- Ensure you copied the entire token
- Check if the app is still installed in your workspace

#### Permission errors
- Verify all required scopes are added
- Reinstall the app after adding new scopes
- For public channels, ensure `chat:write.public` scope is added

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

## Complete Setup Guide

### Prerequisites

- Node.js 18+ installed
- A Slack workspace where you have permissions to create apps
- Claude Code installed

### Quick Setup (5 minutes)

#### 1. Install CCTH

```bash
npm install -g ccth
# or
pnpm add -g ccth
# or
yarn global add ccth
```

#### 2. Create Slack Bot

Follow the [Slack Bot Setup](#slack-bot-setup) section above to:
1. Create a new Slack app
2. Add required bot token scopes (`chat:write`, `chat:write.public`)
3. Install the app to your workspace
4. Copy the bot token (starts with `xoxb-`)
5. Get your channel ID
6. Invite the bot to your channel

#### 3. Configure Environment

```bash
# Option 1: Export in your shell profile (~/.bashrc, ~/.zshrc, etc.)
export SLACK_BOT_TOKEN="xoxb-your-bot-token-here"
export SLACK_CHANNEL="C1234567890"

# Option 2: Create a .env file in your home directory
cat > ~/.env << EOF
SLACK_BOT_TOKEN="xoxb-your-bot-token-here"
SLACK_CHANNEL="C1234567890"
EOF

# Load the environment variables
source ~/.env
```

#### 4. Configure Claude Code

Create or edit `~/.claude/settings.json`:

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

#### 5. Test Your Setup

```bash
# Test with a dry run
echo '{"session_id": "test", "hook_event_name": "UserPromptSubmit", "prompt": "Test message"}' | ccth --dry-run --debug

# If successful, test actual Slack posting
echo '{"session_id": "test", "hook_event_name": "UserPromptSubmit", "prompt": "Hello from CCTH!"}' | ccth
```

You should see a message appear in your Slack channel!

### Advanced Configuration

#### Monitor All Events

For comprehensive session monitoring, add all supported events:

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

#### Project-Specific Configuration

Create `.claude/settings.json` in your project directory for project-specific hooks:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "ccth --channel C0987654321"
          }
        ]
      }
    ]
  }
}
```

#### Multiple Workspaces

Use different channels for different projects:

```bash
# Personal projects
alias ccth-personal='ccth --channel C1111111111'

# Work projects
alias ccth-work='ccth --channel C2222222222'
```

Then update your Claude Code settings to use the aliases.

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