#!/usr/bin/env node
/**
 * Post the current OCE server scoreboard to a Discord channel via webhook.
 *
 * Usage:
 *   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/... \
 *   node scripts/post-discord-scoreboard.js
 *
 * Optional env vars:
 *   DISCORD_USERNAME        - Override the webhook username (default: "OCE Server Status")
 *   DISCORD_AVATAR_URL      - Optional avatar image URL for the webhook message
 *   DISCORD_ROLE_ID         - Role ID to mention in the message (disabled by default)
 *
 * CLI flags:
 *   --dry-run     Print the message instead of posting.
 *   --no-mention  Disable role mention even if DISCORD_ROLE_ID is set.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { fetchServerStatuses, buildDiscordMessage } = require('./scoreboard');

const globalFetch = globalThis.fetch;
if (typeof globalFetch !== 'function') {
  console.error('Global fetch is unavailable. Run this script with Node.js 18+ where fetch is built in.');
  process.exit(1);
}

const fetch = (...args) => globalFetch(...args);

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const WEBHOOK_USERNAME = process.env.DISCORD_USERNAME || 'OCE Server Status';
const WEBHOOK_AVATAR_URL = process.env.DISCORD_AVATAR_URL;
const ROLE_ID = process.env.DISCORD_ROLE_ID;

const argv = new Set(process.argv.slice(2));
const DRY_RUN = argv.has('--dry-run');
const NO_MENTION = argv.has('--no-mention');

if (!WEBHOOK_URL && !DRY_RUN) {
  console.error('Missing DISCORD_WEBHOOK_URL env variable. Set it or use --dry-run for testing.');
  process.exit(1);
}

async function main() {
  const statuses = await fetchServerStatuses();
  const allowedMentions = { parse: [] };

  let message = buildDiscordMessage(statuses);
  if (!NO_MENTION && ROLE_ID && !DRY_RUN) {
    message = `<@&${ROLE_ID}>\n\n${message}`;
    allowedMentions.roles = [ROLE_ID];
  }

  if (message.length > 1900) {
    message = `${message.slice(0, 1897)}...`;
  }

  await postToDiscord(message, allowedMentions);
}

async function postToDiscord(content, allowedMentions) {
  if (DRY_RUN) {
    console.log('--- Discord message (dry run) ---\n');
    console.log(content);
    console.log('\n--- end message ---');
    return;
  }

  const body = {
    username: WEBHOOK_USERNAME,
    content,
    allowed_mentions: allowedMentions,
  };

  if (WEBHOOK_AVATAR_URL) {
    body.avatar_url = WEBHOOK_AVATAR_URL;
  }

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord webhook failed with status ${res.status}: ${text || res.statusText}`);
  }
}

main().catch((err) => {
  console.error('Failed to post scoreboard to Discord:');
  console.error(err instanceof Error ? err.stack || err.message : err);
  process.exitCode = 1;
});
