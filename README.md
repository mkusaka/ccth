# CCTH - Claude Code to Slack Thread Hook

[![CI](https://github.com/mkusaka/ccth/actions/workflows/ci.yml/badge.svg)](https://github.com/mkusaka/ccth/actions/workflows/ci.yml)

A CLI tool that sends Claude Code session messages to Slack threads. Designed to be used as a hook in Claude Code for real-time session monitoring and collaboration.

## Features

- 🔄 Real-time session message forwarding to Slack
- 🧵 Automatic thread management per session
- 📝 Rich message formatting with proper context
- 🔧 Configurable via environment variables or CLI options
- 🧪 Comprehensive test coverage
- 🚀 Built with TypeScript for type safety

## Installation

```bash
# Clone the repository
git clone https://github.com/mkusaka/ccth.git
cd ccth

# Install dependencies
pnpm install

# Build the project
pnpm run build

# Optional: Link globally
npm link
```

## Usage

### As a Claude Code Hook

1. Set up environment variables:

```bash
export SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
export SLACK_CHANNEL="C1234567890"  # Your Slack channel ID
```

2. Configure Claude Code hook in your settings:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "/path/to/ccth/dist/cli.js"
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "/path/to/ccth/dist/cli.js"
      }
    ]
  }
}
```

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

### Example Usage

```bash
# Basic usage with environment variables
echo '{"type": "user", "message": {"role": "user", "content": "Hello"}, ...}' | ccth

# With CLI options
echo '{"type": "user", ...}' | ccth -c C1234567890 -t xoxb-token

# Dry run mode for testing
echo '{"type": "user", ...}' | ccth --dry-run --debug
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

## Message Types Supported

- **User Messages**: User prompts and inputs
- **Assistant Messages**: Claude's responses with tool usage
- **System Messages**: System notifications and errors
- **Summary Messages**: Session summaries

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

#### Monitor All Messages
```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "type": "command",
      "command": "ccth"
    }],
    "PostToolUse": [{
      "type": "command",
      "command": "ccth"
    }]
  }
}
```

#### Monitor Only Tool Usage
```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": ".*",
      "hooks": [{
        "type": "command",
        "command": "ccth --debug"
      }]
    }]
  }
}
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request