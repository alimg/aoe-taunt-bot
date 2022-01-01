# aoe-taunt-bot

## What?
This bot adds the voice lines that you know from AOE 2 chat to your Discord server. **Caution:** everything you see here is very experimental. 

## Why?

Fun.

## Usage
I don't have a permanent place to host this yet, and I doubt it ever will. If someone is willing to donate a VPC or a Raspberry, I might consider though. If you're still reading, you may try your luck with below and I might be online at the time an running the bot on my computer.

1. Invite the bot into your Discord server: https://discord.com/api/oauth2/authorize?client_id=926184606984708147&permissions=274881059904&scope=bot
2. Join a voice channel.
3. Type `11` in the chat.
4. Profit!

## Hacking
* It needs ffmpeg to be installed on your system
* Build using `npm install && npm run build`
  - This command has dependencies on `make`, `libtool`, `g++`.
* Obtain your own bot token from https://discord.com/developers/applications
* Launch it by `BOT_TOKEN=<your-token> npm start`

