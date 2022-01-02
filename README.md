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

### Using config.json

AOE-taunt-bot also utilizes a config.json file for various canfigurations.

**Naming**: Default name for the file is `config.json` and it is located at the root folder of the project. File location and name can be changed but must be supplied as a running argument. 

```
npm start 
# uses ./config.json

npm start my_config.json 
# uses ./my_config.json
```

### Options

Fully typed structure of config file is given below

```
{
  "botToken": string,
  "botConfig": {
    maxConcurrentPlayers: number,
    disconnectAferInactivityMs: number,
    dataDir: string,
    myInstantsEnabled: boolean
  }
}
```

**botToken**: The bot token that you can acquire from discord developer page. This token can also be provided as environment variable which has priority over config file. Make sure that environment variable is unset if you are providing your token through config file.

**botConfig.maxConcurrentPlayers**: How many concurrent connections that the bot can support. Default is 256.

**botConfig.disconnectAfterInactivityMs**: AOE-taunt-bot is considerate of your voice channels. If there is no interaction with the bot for a set amount of time, the bot will leave the channel. Default is 5 minutes.

**botConfig.dataDir**: Data folder location to read supported mp3 files. Default is `data`.

**botConfig.myInstantsEnabled**: The bot supports replaying buttons from `myinstants.com`. This feature can be toggled by this config. Default is true.

