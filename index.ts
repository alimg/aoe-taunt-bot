import {
  AudioPlayerStatus, createAudioPlayer, createAudioResource, entersState, joinVoiceChannel,
  StreamType, VoiceConnectionStatus
} from '@discordjs/voice';
import * as Discord from 'discord.js'
import { createDiscordJSAdapter } from './adapter';

import * as config from "./config.json";

const client = new Discord.Client({
  intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES"]
});

const player = createAudioPlayer();

function playSong(file: string) {
  console.log("playing", file)
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

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) {
    return;
  }
  const number = parseInt(message.content)
  var file: string | null = null;
  if (number > 0 && number < 43) {
    file = `data/${number}.mp3`;
  }
  if (message.content === "ready" || message.content === "weaver") {
    file = `data/${message.content}.mp3`;
  }
  if (message.content.startsWith("instant")) {
    const d = encodeURIComponent(message.content.substr("instant".length).trim())
    file = `https://www.myinstants.com/media/sounds/${d}.mp3`;
  }
  if (file) {
    const channel = message.member?.voice.channel;
    if (channel) {
      try {
        const connection = await connectToChannel(channel);
        connection.subscribe(player);
        await playSong(file);
      } catch (error) {
        console.error(error);
      }
    } else {
      message.reply('Join a voice channel then try again!');
    }
  }
});
client.login(config.BOT_TOKEN);

