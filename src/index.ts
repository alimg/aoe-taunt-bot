#!/usr/bin/env node
import fs from 'fs';
import { BotConfig, createBot } from "./bot";

interface RunConfig {
  botToken?: string,
  botConfig: Partial<BotConfig>
}

console.log("Running with args:", process.argv)
const configPath = process.argv[2] || "config.json";

const config: RunConfig = fs.existsSync(configPath) ?
  JSON.parse(fs.readFileSync(configPath).toString("utf-8")) : {};
const token = process.env.BOT_TOKEN || config.botToken

if (!token) {
  throw new Error("missing bot token");
}

const client = createBot({
  dataDir: "data",
  disconnectAferInactivityMs: 5 * 60_0000,
  myInstantsEnabled: true,
  maxConcurrentPlayers: 256,
  ...config.botConfig
});
client.login(token);
