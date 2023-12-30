import log from 'loglevel';

import {
  AudioPlayer, AudioPlayerStatus, createAudioResource, entersState, joinVoiceChannel,
  StreamType, VoiceConnectionStatus
} from '@discordjs/voice';
import * as Discord from 'discord.js';
import { GatewayIntentBits } from 'discord.js';


import { createDiscordJSAdapter } from './adapter';
import { BotContext } from './botcontext';
import { makeCommander } from './command';

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
    try {
      connection.destroy();
    } catch (error) {
      console.log("error while destroying connection", error)
    }
    throw error;
  }
}


export function createBot(config: BotConfig) {
  log.info("Initializing with", config);

  const client = new Discord.Client({intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates]});

  const botContext = new BotContext(config)
  const commander = makeCommander(botContext)

  client.on("messageCreate", async (message) => {
    if (message.inGuild()) {
      await commander.evaluate(client, message)
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
        const channel = newState.channel;
        if (channel) {
          await commander.playPersonalTheme(newState.guild.id, newState.id, channel)
        }
      }
      catch (error) {
        log.error(error);
      }
    }
  })
  return client;
}
