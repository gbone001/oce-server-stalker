#!/usr/bin/env node
/**
 * Discord bot that posts the server scoreboard on an interval and exposes slash commands.
 *
 * Required environment variables:
 *   DISCORD_BOT_TOKEN       - Bot token from the Discord developer portal.
 *   DISCORD_GUILD_ID        - Guild (server) where slash commands should be registered.
 *   DISCORD_CHANNEL_ID      - Channel ID where scoreboard updates are posted.
 *
 * Optional environment variables:
 *   DISCORD_ROLE_ID         - Role ID to mention when posting updates.
 *   SCOREBOARD_INTERVAL_MINUTES - Initial posting interval in minutes (default: 5).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Client, GatewayIntentBits, Partials, Events, SlashCommandBuilder } = require('discord.js');
const {
  fetchServerStatuses,
  buildDiscordMessages,
} = require('./scoreboard');

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const ROLE_ID = process.env.DISCORD_ROLE_ID;

if (!BOT_TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN env variable.');
  process.exit(1);
}
if (!GUILD_ID) {
  console.error('Missing DISCORD_GUILD_ID env variable.');
  process.exit(1);
}
if (!CHANNEL_ID) {
  console.error('Missing DISCORD_CHANNEL_ID env variable.');
  process.exit(1);
}

const DEFAULT_INTERVAL_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.SCOREBOARD_INTERVAL_MINUTES, 10) || 5
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel],
});

let channelRef = null;
let postingIntervalMinutes = DEFAULT_INTERVAL_MINUTES;
let intervalHandle = null;
let inFlight = false;

const slashCommands = [
  new SlashCommandBuilder()
    .setName('setfrequency')
    .setDescription('Adjust how often the scoreboard is posted (minutes).')
    .addIntegerOption((option) =>
      option
        .setName('minutes')
        .setDescription('Number of minutes between posts.')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(180)
    ),
  new SlashCommandBuilder()
    .setName('stalknow')
    .setDescription('Immediately refresh and post the latest scoreboard.'),
].map((builder) => builder.toJSON());

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  try {
    await readyClient.application.commands.set(slashCommands, GUILD_ID);
    console.log('Slash commands registered for guild:', GUILD_ID);
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }

  try {
    channelRef = await readyClient.channels.fetch(CHANNEL_ID);
    if (!channelRef || !channelRef.isTextBased()) {
      throw new Error('Channel is not text-based or could not be fetched.');
    }
    console.log(`Posting scoreboard updates in #${channelRef?.name ?? CHANNEL_ID}`);
  } catch (err) {
    console.error('Failed to fetch posting channel:', err);
    process.exit(1);
  }

  await postScoreboard('startup');
  schedulePosting(postingIntervalMinutes);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  if (interaction.commandName === 'setfrequency') {
    const minutes = interaction.options.getInteger('minutes', true);
    postingIntervalMinutes = minutes;
    schedulePosting(minutes);
    await interaction.reply({
      content: `Scoreboard will now post every ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      ephemeral: true,
    });
    return;
  }

  if (interaction.commandName === 'stalknow') {
    if (inFlight) {
      await interaction.reply({
        content: 'A scoreboard update is already running. Try again shortly.',
        ephemeral: true,
      });
      return;
    }

    try {
      await interaction.reply({ content: 'Refreshing the scoreboard now…', ephemeral: true });
    } catch (err) {
      console.error('Failed to acknowledge slash command:', err);
      return;
    }

    try {
      const triggered = await postScoreboard('slash');
      if (triggered) {
        await interaction.editReply({ content: 'Scoreboard refreshed and posted.' });
      } else {
        await interaction.editReply({
          content: 'Unable to post right now; please try again shortly.',
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await interaction.editReply({ content: `Failed to refresh the scoreboard: ${message}` });
    }
    return;
  }
});

// helper: send an array of messages sequentially
async function sendMessagesSequentially(channel, messages, roleId) {
  if (!messages || !messages.length) return;
  let first = true;
  for (const msg of messages) {
    const content = first && roleId ? `<@&${roleId}>\n\n${msg}` : msg;
    await channel.send({ content });
    first = false;
  }
}


async function postScoreboard(trigger) {
  if (!channelRef) {
    console.warn('Skipping scoreboard post because the channel reference is not ready.');
    return false;
  }
  if (inFlight) {
    console.warn('Skipped scoreboard post because a previous run is still in progress.');
    return false;
  }
  inFlight = true;
  console.log(`[${new Date().toISOString()}] Running scoreboard update (trigger: ${trigger})`);

  let success = false;
  try {
    const statuses = await fetchServerStatuses();
    const messages = buildDiscordMessages(statuses, 1800);
    await sendMessagesSequentially(channelRef, messages, ROLE_ID);
    console.log(
      `Scoreboard posted successfully (${messages.length} message${messages.length === 1 ? '' : 's'}).`
    );
    success = true;
  } catch (err) {
    console.error('Failed to post scoreboard:', err);
    try {
      await channelRef.send({
        content: `Failed to fetch scoreboard data: ${err instanceof Error ? err.message : String(err)}`,
      });
    } catch (postErr) {
      console.error('Additionally failed to report error in channel:', postErr);
    }
  } finally {
    inFlight = false;
  }

  return success;
}

function schedulePosting(minutes) {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  const ms = minutes * 60 * 1000;
  intervalHandle = setInterval(() => {
    postScoreboard('interval').catch((err) => console.error('Interval post failed:', err));
  }, ms);
  console.log(`Scoreboard posting interval set to ${minutes} minute(s).`);
}

client.login(BOT_TOKEN).catch((err) => {
  console.error('Discord login failed:', err);
  process.exit(1);
});
