import path from 'path';
import log from 'loglevel';

import {
  AudioPlayer, AudioPlayerStatus, createAudioResource, entersState, joinVoiceChannel,
  StreamType, VoiceConnectionStatus
} from '@discordjs/voice';
import * as Discord from 'discord.js'

import { createDiscordJSAdapter } from './adapter';
import { PlayerCache } from './player-cache';

const INT_PATTERN = /^-?\d+$/

export interface BotConfig {
  maxConcurrentPlayers: number
  disconnectAferInactivityMs: number
  dataDir: string
  myInstantsEnabled: boolean
}


function playTaunt(player: AudioPlayer, file: string) {
  log.info("playing", file);
  const resource = createAudioResource(file, {
    inputType: StreamType.Arbitrary,
  });

  player.play(resource);

  return entersState(player, AudioPlayerStatus.Playing, 5e3);
}

async function connectToChannel(channel: Discord.VoiceBasedChannel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: createDiscordJSAdapter(channel),
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
    return connection;
  } catch (error) {
    connection.destroy();
    throw error;
  }
}


export function createBot(config: BotConfig) {
  log.info("Initializing with", config);

  const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES"]});

  const playerCache = new PlayerCache(config.maxConcurrentPlayers, config.disconnectAferInactivityMs);

  
  function parseTaunt(content: string) {
    const number = INT_PATTERN.test(content) && parseInt(content, 10);
    if (number > 0 && number < 43) {
      return path.resolve(config.dataDir, `${number}.mp3`);
    }
    if (content === "ready" || content === "weaver") {
      return path.resolve(config.dataDir, `${content}.mp3`);
    }
    if (config.myInstantsEnabled && content.startsWith("instant")) {
      const sound = encodeURIComponent(content.substr("instant".length).trim().substr(0, 256))
      return `https://www.myinstants.com/media/sounds/${sound}.mp3`;
    }
    return null;
  }

  client.on("messageCreate", async (message) => {
    if (!message.guild || message.author.bot) {
      return;
    }
    var file = parseTaunt(message.content);

    if (file) {
      const channel = message.member?.voice.channel;
      if (channel) {
        try {
          const connection = await connectToChannel(channel);
          const player = playerCache.acquire(connection);
          if (player) {
            await playTaunt(player, file);
          } else {
            message.reply('I have great many mouths and yet there\'s none to spare.');
          }
        } catch (error) {
          log.info(error);
        }
      } else {
        message.reply('Join a voice channel then try again!');
      }
    }
  });
  return client;
}
