# Claude Code Settings Examples

This directory contains example configurations for Claude Code's `settings.json`.

## Settings File Locations

- **User settings**: `~/.claude/settings.json`
- **Project settings**: `.claude/settings.json` (in project root)
- **Local settings**: `.claude/settings.local.json` (recommended to add to .gitignore)

## Environment Variables

Before using ccth, set the following environment variables:

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.config/fish/config.fish
export SLACK_BOT_TOKEN="xoxb-your-slack-bot-token"
export SLACK_CHANNEL="C1234567890"  # Slack channel ID
```

## Configuration Examples

### 1. All Events (`claude-settings-all-events.json`)

Handles ALL Claude Code events (comprehensive monitoring):
- User prompts
- Pre-tool execution (before tools run)
- Post-tool execution (after tools complete)
- Session completion with assistant response
- Subagent completion (Task tool)
- Notifications (permissions, idle)
- Pre-compact events

Note: This can be quite verbose. Use for debugging or complete audit trails.

### 2. Full Featured (`claude-settings.json`)

Handles all major events for typical usage:
- User prompts
- Tool execution results
- Session completion with assistant response (including thinking)
- Notifications (permission requests, idle notifications)

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

### 3. Minimal Configuration (`claude-settings-minimal.json`)

Only captures conversation essentials:
- User prompts
- Session completion with assistant response

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

### 4. Specific Tools Monitoring (`claude-settings-specific-tools.json`)

Monitor only specific tools:
- File editing tools (Write, Edit, MultiEdit) in normal mode
- Bash commands with debug logging

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
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "ccth"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "ccth --debug"
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

## Command Line Options

Each hook can use the following options:

- `-c, --channel <channel>`: Send to specific channel
- `-t, --token <token>`: Use specific Slack token
- `-d, --debug`: Enable debug logging
- `--dry-run`: Test without sending to Slack
- `--thread-timeout <seconds>`: Thread timeout (default: 3600 seconds)

Example:
```json
{
  "type": "command",
  "command": "ccth --debug --channel C987654321"
}
```

## Tips

1. **Per-project configuration**: Use different Slack channels per project by setting `.claude/settings.json` in project root
2. **Temporary disable**: Use `--dry-run` to temporarily disable Slack sending
3. **Debugging**: Use `--debug` option to see detailed logs when troubleshooting
4. **Event filtering**: Start with minimal configuration and add more events as needed