#!/usr/bin/env node
import fs from 'fs';
import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';
import { BotConfig, createBot } from "./bot";

prefix.reg(log);
log.setLevel("info")
prefix.apply(log, {
  timestampFormatter: (date) => date.toISOString(),
  format: (level, name, timestamp) => `${timestamp} [${level}]`
})

interface RunConfig {
  botToken?: string,
  botConfig: Partial<BotConfig>
}

log.info("Running with args:", process.argv)
const configPath = process.argv[2] || "config.json";

log.info("Config path:", configPath)

const config: RunConfig = fs.existsSync(configPath) ?
  JSON.parse(fs.readFileSync(configPath).toString("utf-8")) : {};
const token = process.env.BOT_TOKEN || config.botToken

if (!token) {
  throw new Error("missing bot token");
}

const client = createBot({
  dataDir: "data",
  disconnectAferInactivityMs: 5 * 60_000,
  myInstantsEnabled: true,
  wikiaCDNEnabled: true,
  maxConcurrentPlayers: 256,
  bannedSounds: [],
  ...config.botConfig
});
client.login(token);
