#!/usr/bin/env node
import { Command } from "commander";
import { config } from "dotenv";
import packageJson from "../package.json" with { type: "json" };
const { version } = packageJson;
import { processHookInput } from "./hook-processor.js";
import { initializeSlackClient } from "./slack/client.js";
import { createThreadManager } from "./slack/thread-manager.js";
import { logger } from "./utils/logger.js";

// Load environment variables
config();

const program = new Command();

program
  .name("ccth")
  .description("Claude Code session messages to Slack thread notifier")
  .version(version)
  .option(
    "-c, --channel <channel>",
    "Slack channel ID or name",
    process.env.SLACK_CHANNEL,
  )
  .option("-t, --token <token>", "Slack bot token", process.env.SLACK_BOT_TOKEN)
  .option("-d, --debug", "Enable debug logging", false)
  .option("--dry-run", "Process messages without sending to Slack", false)
  .option(
    "--thread-timeout <seconds>",
    "Thread inactivity timeout in seconds",
    "3600",
  )
  .action(async (options) => {
    try {
      // Validate required options
      if (!options.channel) {
        throw new Error(
          "Slack channel is required. Set SLACK_CHANNEL env var or use -c option.",
        );
      }
      if (!options.token && !options.dryRun) {
        throw new Error(
          "Slack token is required. Set SLACK_BOT_TOKEN env var or use -t option.",
        );
      }

      // Set log level
      if (options.debug) {
        logger.setLevel("debug");
      }

      // Initialize Slack client
      const slackClient = options.dryRun
        ? null
        : await initializeSlackClient(options.token);

      const threadTimeoutSeconds = parseInt(options.threadTimeout, 10);

      // Create thread manager for cleanup (only needed if not dry-run)
      let threadManager = null;
      if (!options.dryRun) {
        threadManager = createThreadManager({
          client: slackClient,
          channel: options.channel,
          timeoutSeconds: threadTimeoutSeconds,
        });
      }

      try {
        // Process hook input from stdin
        await processHookInput({
          slackClient,
          channel: options.channel,
          dryRun: options.dryRun,
          threadTimeoutSeconds,
        });

        logger.debug("Hook processing completed successfully");
      } finally {
        // Clean up thread manager
        if (threadManager) {
          threadManager.destroy();
        }
      }

      process.exit(0);
    } catch (error) {
      logger.error("Fatal error:", error);
      process.exit(1);
    }
  });

// Handle uncaught errors
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled rejection:", error);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  process.exit(1);
});

program.parse();
