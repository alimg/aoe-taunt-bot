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
import {searchMediaWikiAudioFile} from "./mediawiki-adapter";

export interface BotConfig {
  maxConcurrentPlayers: number
  disconnectAferInactivityMs: number
  dataDir: string
  myInstantsEnabled: boolean
  mediawikiCDNEnabled: boolean
  fandomDomains: {[name:string]: string}
  bannedSounds: string[]
}


export function playTaunt(player: AudioPlayer, file: string) {
  const resource = createAudioResource(file, {
    inputType: StreamType.Arbitrary,
  });

  player.play(resource);

  return entersState(player, AudioPlayerStatus.Playing, 5e3);
}

export async function connectToChannel(channel: Discord.VoiceBasedChannel) {
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
  const configStore = new Keyv<{personalThemes?: {[authorId: string]: string}}>('sqlite://db_guild_preferences.sqlite');

  async function createAlias(guildId: string, aliasName: string, aliasValue: string) {
    const aliasMap = {...await getAliases(guildId), [aliasName]: aliasValue};
    if (Object.keys(aliasMap).length <= 200) {
      await aliasStore.set(guildId, aliasMap);
    }
  }
  async function setPersonalTheme(guildId: string, authorId: string, themeCommand: string) {
    const conf = await configStore.get(guildId)
    if (conf?.personalThemes) {
      await configStore.set(guildId, {...conf, personalThemes: {
        ...(conf.personalThemes ?? {}),
        [authorId]: themeCommand
      }})
    } else {
      await configStore.set(guildId, {personalThemes: {
        [authorId]: themeCommand
      }})
    }
  }
  async function getPersonalTheme(guildId: string, authorId: string) {
    return ((await configStore.get(guildId))?.personalThemes??{})[authorId] ?? ""
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
      } else if (words[0] + words[1] + words[2] === "setmytheme") {
        const themeCommand = words.slice(3).join(" ")
        log.info("set theme (gid,uid,cmd)", message.guildId, message.author.id, themeCommand)
        await setPersonalTheme(message.guildId, message.author.id, themeCommand)
        await message.react("👍")
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
      const sound = encodeURIComponent(content.slice("instant".length).trim().slice(0, 256))
      return `https://www.myinstants.com/media/sounds/${sound}.mp3`;
    }
    if (config.mediawikiCDNEnabled && content.startsWith("fandom")) {
      const [domain, filename] = content.slice("fandom".length).trim().split(/\s+/);
      const link = await searchMediaWikiAudioFile(config.fandomDomains[domain], filename);
      return link;
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
        if (config.bannedSounds.some(pattern => file?.indexOf(pattern) >= 0)) {
          message.reply("Don't speak to me like that. Ever.");
          return;
        }
        const channel = message.member?.voice.channel;
        if (channel) {
          const connection = await connectToChannel(channel);
          const player = playerCache.acquire(connection);
          if (player) {
            log.info("playing", file, message.guild.name, message.guild.id, channel.id);
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

  // when someone joins a channel
  client.on("voiceStateUpdate", async (oldState, newState) => {
    if (oldState.channelId != newState.channelId && newState.channelId) {

      if (!newState.guild || newState.member?.user.bot) {
        return;
      }
      log.info("user entered voice channel (userId,channelId:)", newState.id, newState.channelId)

      try {
        const file = await parseTaunt(await getPersonalTheme(newState.guild.id, newState.id));

        if (file) {
          if (config.bannedSounds.some(pattern => file?.indexOf(pattern) >= 0)) {
            return;
          }
          const channel = newState.channel;
          if (channel) {
            const connection = await connectToChannel(channel);
            const player = playerCache.acquire(connection);
            if (player) {
              log.info("playing", file, newState.guild.name, newState.guild.id, channel.id);
              await playTaunt(player, file);
            } 
          }
        } 
      }
      catch (error) {
        log.error(error);
      }
    }
  })
  return client;
}
