"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const voice_1 = require("@discordjs/voice");
const Discord = __importStar(require("discord.js"));
const adapter_1 = require("./adapter");
const config = __importStar(require("./config.json"));
const client = new Discord.Client({
    intents: ["GUILDS", "GUILD_MESSAGES", "GUILD_VOICE_STATES"]
});
const player = (0, voice_1.createAudioPlayer)();
function playSong(file) {
    console.log("playing", file);
    const resource = (0, voice_1.createAudioResource)(file, {
        inputType: voice_1.StreamType.Arbitrary,
    });
    player.play(resource);
    return (0, voice_1.entersState)(player, voice_1.AudioPlayerStatus.Playing, 5e3);
}
function connectToChannel(channel) {
    return __awaiter(this, void 0, void 0, function* () {
        const connection = (0, voice_1.joinVoiceChannel)({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: (0, adapter_1.createDiscordJSAdapter)(channel),
        });
        try {
            yield (0, voice_1.entersState)(connection, voice_1.VoiceConnectionStatus.Ready, 30e3);
            return connection;
        }
        catch (error) {
            connection.destroy();
            throw error;
        }
    });
}
client.on("messageCreate", (message) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (!message.guild || message.author.bot) {
        return;
    }
    console.log(message.content);
    const b = parseInt(message.content);
    var dude = null;
    if (b > 0 && b < 43) {
        dude = `data/${b}.mp3`;
    }
    if (message.content === "ready" || message.content === "weaver") {
        dude = `data/${message.content}.mp3`;
    }
    if (message.content.startsWith("instant")) {
        const d = encodeURIComponent(message.content.substr("instant".length).trim());
        dude = `https://www.myinstants.com/media/sounds/${d}.mp3`;
    }
    if (dude) {
        const channel = (_a = message.member) === null || _a === void 0 ? void 0 : _a.voice.channel;
        if (channel) {
            try {
                const connection = yield connectToChannel(channel);
                const subs = connection.subscribe(player);
                yield playSong(dude);
            }
            catch (error) {
                console.error(error);
            }
        }
        else {
            message.reply('Join a voice channel then try again!');
        }
    }
}));
client.login(config.BOT_TOKEN);
