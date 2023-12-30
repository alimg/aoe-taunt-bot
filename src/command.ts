import fs from 'fs';
import path from 'path';
import log from 'loglevel';

import { Client, Message, VoiceBasedChannel, codeBlock } from "discord.js"
import { BotContext } from "./botcontext"
import { searchMediaWikiAudioFile } from "./mediawiki-adapter"


type CommandHandler = (message: Message<true>, words: string[]) => Promise<void>


export function makeCommander(botContext: BotContext) {
  const botCommands: {[keywords: string]: CommandHandler} = {
    "create alias": async function(message, words: string[]) {
      const aliasName = words[2]
      const aliasValue = words.slice(3).join(" ")
      await botContext.createAlias(message.guildId, aliasName, aliasValue)
      await message.reply(`You can now type ${aliasName} to execute ${aliasValue} by mentioning me`);
    },
    
    "list aliases": async function(message) {
      const entries = Object.entries(await botContext.getAliases(message.guildId)).sort((a,b) => a[0].localeCompare(b[0]))
      if (entries.length === 0) {
        await message.reply("There are no aliases")
      } else {
        const replyContent = codeBlock(entries.map(line => line.join("➡️")).join("\n"))
        await message.reply(replyContent)
      }
    },

    "set my theme":  async function(message, words) {
      const themeCommand = words.slice(3).join(" ")
      log.info("set theme (gid,uid,cmd)", message.guildId, message.author.id, themeCommand)
      await botContext.setPersonalTheme(message.guildId, message.author.id, themeCommand)
      await message.react("👍")
    }
  }

  function isBanned(file: string) {
    if (botContext.config.bannedSounds.some(pattern => file?.indexOf(pattern) >= 0)) {
      return true
    }
    return false
  }

  async function playTauntCommand(message: Message<true>, taunt: string) {
    const file = await resolveFile(taunt)
    if (file) {
      if (isBanned(file)) {
        await message.reply("Don't speak to me like that. Ever.");
        return
      }
      const channel = message.member?.voice.channel
      if (channel) {
        log.info("attempt playing", file, message.guild.name, message.guild.id, channel.id);
        const player = await botContext.tryJoinAndPlay(channel, file)
        if (!player) {
          await message.reply('I have great many mouths and yet there\'s none to spare.');
        }
      } else {
        await message.reply('Join a voice channel then try again!');
      }
    }
  }

  
  async function resolveFile(content: string) {
    const config = botContext.config
    content = content.slice(0, 256) // limiting the length of command string to prevent bad user input
    if (fs.readdirSync(config.dataDir).indexOf(`${content}.mp3`) >= 0) {
      return path.resolve(config.dataDir, `${content}.mp3`);
    }
    if (config.myInstantsEnabled && content.startsWith("instant")) {
      const sound = encodeURIComponent(content.slice("instant".length).trim())
      return `https://www.myinstants.com/media/sounds/${sound}.mp3`;
    }
    if (config.mediawikiCDNEnabled && content.startsWith("fandom")) {
      const [domain, filename] = content.slice("fandom".length).trim().split(/\s+/);
      const link = await searchMediaWikiAudioFile(config.fandomDomains[domain], filename);
      return link;
    }
    return null;
  }

  return {
    async evaluate(client: Client, message: Message<true>){
      const botUserId = client.user?.id;
      if (!botUserId) {
        return
      }
    
      if (message.mentions.users.hasAny(botUserId)) {
        const words = message.content
          .replace(`<@!${botUserId}>`, "") // desktop mentions
          .replace(`<@${botUserId}>`, "") // mobile mentions
          .trim()
          .split(/ +/);
        for (const [keywords, command] of Object.entries(botCommands)) {
          const kw = keywords.split(" ")
          if (words.slice(0, kw.length) === kw) {
            await command(message, words)
            return
          }
        }
        const replacement = await botContext.fetchAlias(message.guildId, words[0]);
        if (replacement) {
          await playTauntCommand(message, replacement)
        }
      }
      await playTauntCommand(message, message.content)
    },
    async playPersonalTheme(guildId: string, userId: string, channel: VoiceBasedChannel) {
      const theme = await resolveFile(await botContext.getPersonalTheme(guildId, userId))
      if (theme) {
        if (!isBanned(theme)) {
          await botContext.tryJoinAndPlay(channel, theme)
        }
      }
    } 
  }
}
