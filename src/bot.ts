import fs from 'fs';
import path from 'path';
import log from 'loglevel';

import {
  AudioPlayer, AudioPlayerStatus, createAudioResource, entersState, joinVoiceChannel,
  StreamType, VoiceConnectionStatus
} from '@discordjs/voice';
import * as Discord from 'discord.js';
import { codeBlock } from '@discordjs/builders';

import Keyv from 'keyv';

import { createDiscordJSAdapter } from './adapter';
import { PlayerCache } from './player-cache';

export interface BotConfig {
  maxConcurrentPlayers: number
  disconnectAferInactivityMs: number
  dataDir: string
  myInstantsEnabled: boolean
}


function playTaunt(player: AudioPlayer, file: string) {
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

  const aliasStore = new Keyv<{[aliasName: string]: string}>('sqlite://db.sqlite');

  async function createAlias(guildId: string, aliasName: string, aliasValue: string) {
    const aliasMap = {...await getAliases(guildId), [aliasName]: aliasValue};
    if (Object.keys(aliasMap).length <= 20) {
      await aliasStore.set(guildId, aliasMap);
    }
  }
  
  async function getAliases(guildId: string) {
    return await aliasStore.get(guildId) || {}
  }

  async function fetchAlias(guildId: string, aliasName: string): Promise<string | null> {
    const aliasMap = await getAliases(guildId);
    return aliasMap[aliasName];
  }

  async function getContent(message: Discord.Message<boolean>): Promise<string> {
    const userId = client.user?.id;
    if (!message.guildId || !userId) {
      return ""
    }
    if (message.mentions.users.hasAny(userId)) {
      const words = message.content
        .replace(`<@!${client.user?.id}>`, "") // desktop mentions
        .replace(`<@${client.user?.id}>`, "") // mobile mentions
        .trim()
        .split(/ +/);
        
      if (words[0] + words[1] === "createalias") {
        const aliasName = words[2]
        const aliasValue = words.slice(3).join(" ")
        await createAlias(message.guildId, aliasName, aliasValue)
        await message.reply(`You can now type ${aliasName} to execute ${aliasValue} by mentioning me`);
        return "";
      } else if (words[0] + words[1] === "listaliases") {
        const entries = Object.entries(await getAliases(message.guildId)).sort((a,b) => a[0].localeCompare(b[0]))
        if (entries.length === 0) {
          await message.reply("There are no aliases")
        } else {
          const replyContent = codeBlock(entries.map(line => line.join("➡️")).join("\n"))
          await message.reply(replyContent)
        }
        return "";
      }
      // check if alias already exists for this user and content
      const replacement = await fetchAlias(message.guildId, words[0]);
      if (replacement) {
        return replacement;
      }
    }

    return message.content
  }

  async function parseTaunt(content: string) {
    if (fs.readdirSync(config.dataDir).indexOf(`${content}.mp3`) >= 0) {
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

    try {
      const file = await parseTaunt(await getContent(message));

      if (file) {
        const channel = message.member?.voice.channel;
        if (channel) {
          const connection = await connectToChannel(channel);
          const player = playerCache.acquire(connection);
          if (player) {
            log.info("playing", file, message.guild.name, message.guild.id);
            await playTaunt(player, file);
          } else {
            message.reply('I have great many mouths and yet there\'s none to spare.');
          }
        } else {
          message.reply('Join a voice channel then try again!');
        }
      } 
    }
    catch (error) {
      log.error(error);
    }
  });
  return client;
}
