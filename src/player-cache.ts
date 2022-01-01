import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, PlayerSubscription, VoiceConnection } from "@discordjs/voice";
import { Snowflake } from "discord-api-types";
import log from "loglevel"

type ConnectionInfo = {subscription: PlayerSubscription, disconnectTimer?: NodeJS.Timeout}

export class PlayerCache {
  private readonly availablePlayers: Array<AudioPlayer> = new Array();
  private totalPlayers = 0
  private readonly activeConnections: Map<Snowflake, ConnectionInfo> = new Map();

  constructor(
    public readonly maxPlayers: number,
    public readonly disconnectTimeoutMs: number) {
  }

  acquire(connection: VoiceConnection): AudioPlayer | null {
    log.info(`PlayerCache stats: created ${this.totalPlayers} available: ${this.availablePlayers.length}, channels: ${this.activeConnections.size}`)
    const channelId = connection.joinConfig.channelId
    if (!channelId) {
      throw new Error("Connection is missing channelId");
    }    
    
    const existingSubscription = this.activeConnections.get(channelId);
    const player = this.getPlayer();
    if (!player) {
      return null;
    }
    if (existingSubscription?.disconnectTimer) {
      clearTimeout(existingSubscription.disconnectTimer);
      delete existingSubscription.disconnectTimer;
    }

    const subscription = connection.subscribe(player)
    if (!subscription) {
      player.removeAllListeners()
      this.availablePlayers.push(player);
      throw new Error("Failed to create player subscription. ChannelID:" + connection.joinConfig.channelId);
    }

    if (!existingSubscription) {
      this.activeConnections.set(channelId, {subscription})
    }
    return player
  }

  private getPlayer(): AudioPlayer | null {
    if (this.availablePlayers.length > 0) {
      return this.availablePlayers.shift()!
    }

    if (this.totalPlayers < this.maxPlayers) {
      this.totalPlayers++;
      return this.createPlayer();
    }

    return null;
  }

  private createPlayer() {
    const player = createAudioPlayer();
    player.on("unsubscribe", (subs) => {
      this.availablePlayers.push(player);
      this.activeConnections.delete(subs.connection.joinConfig.channelId!);
    });
    player.on("stateChange", (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle) {
        (player["subscribers"] as PlayerSubscription[]).forEach(subscription => {
          const channelId = subscription.connection.joinConfig.channelId;
          if (channelId) {
            const connectionInfo = this.activeConnections.get(channelId);
            if (connectionInfo) {
              if (connectionInfo.disconnectTimer) {
                clearTimeout(connectionInfo.disconnectTimer);
              }
              connectionInfo.disconnectTimer = setTimeout(
                () => {
                  connectionInfo.subscription.unsubscribe();
                  connectionInfo.subscription.connection.disconnect();
                },
                this.disconnectTimeoutMs);
            }
          }
        });
      }
    });
    player.on("error", log.warn);
    return player;
  }
}