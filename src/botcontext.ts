import Keyv from "keyv";
import { PlayerCache } from "./player-cache";
import { BotConfig } from "./bot";
import { AudioPlayer, AudioPlayerStatus, StreamType, VoiceConnectionStatus, createAudioResource, entersState, joinVoiceChannel } from "@discordjs/voice";
import { VoiceBasedChannel } from "discord.js";
import { createDiscordJSAdapter } from "./adapter";

export class BotContext {
  config: BotConfig;
  playerCache: PlayerCache;
  aliasStore: Keyv<{ [aliasName: string]: string; }, Record<string, unknown>>;
  configStore: Keyv<{ personalThemes?: { [authorId: string]: string; } | undefined; }, Record<string, unknown>>;

  constructor(config: BotConfig) {
    this.config = config;
    this.playerCache = new PlayerCache(config.maxConcurrentPlayers, config.disconnectAferInactivityMs);

    this.aliasStore = new Keyv<{[aliasName: string]: string}>('sqlite://db.sqlite');
    this.configStore = new Keyv<{personalThemes?: {[authorId: string]: string}}>('sqlite://db_guild_preferences.sqlite');
  }

  async createAlias(guildId: string, aliasName: string, aliasValue: string) {
    const aliasMap = {...await this.getAliases(guildId), [aliasName]: aliasValue};
    if (Object.keys(aliasMap).length <= 200) {
      await this.aliasStore.set(guildId, aliasMap);
    }
  }
  async setPersonalTheme(guildId: string, authorId: string, themeCommand: string) {
    const conf = await this.configStore.get(guildId)
    if (conf?.personalThemes) {
      await this.configStore.set(guildId, {...conf, personalThemes: {
        ...(conf.personalThemes ?? {}),
        [authorId]: themeCommand
      }})
    } else {
      await this.configStore.set(guildId, {personalThemes: {
        [authorId]: themeCommand
      }})
    }
  }
  async getPersonalTheme(guildId: string, authorId: string) {
    return ((await this.configStore.get(guildId))?.personalThemes??{})[authorId] ?? ""
  }
  
  async getAliases(guildId: string) {
    return await this.aliasStore.get(guildId) || {}
  }

  async fetchAlias(guildId: string, aliasName: string): Promise<string | null> {
    const aliasMap = await this.getAliases(guildId);
    return aliasMap[aliasName];
  }

  async tryJoinAndPlay(channel: VoiceBasedChannel, file: string) {
    const connection = await connectToChannel(channel);
    const player = this.playerCache.acquire(connection);
    if (player) {
      return await playTaunt(player, file);
    }
  }
}


export function playTaunt(player: AudioPlayer, file: string) {
  const resource = createAudioResource(file, {
    inputType: StreamType.Arbitrary,
  });

  player.play(resource);

  return entersState(player, AudioPlayerStatus.Playing, 5e3);
}

export async function connectToChannel(channel: VoiceBasedChannel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: createDiscordJSAdapter(channel),
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
    return connection;
  } catch (error) {
    try {
      connection.destroy();
    } catch (error) {
      console.log("error while destroying connection", error)
    }
    throw error;
  }
}
