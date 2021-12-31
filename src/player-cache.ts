import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, PlayerSubscription, VoiceConnection } from "@discordjs/voice";
import { Snowflake } from "discord-api-types";

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
    console.log(`PlayerCache stats: created ${this.totalPlayers} available: ${this.availablePlayers.length}, channels: ${this.activeConnections.size}`)
    const channelId = connection.joinConfig.channelId
    if (!channelId) {
      throw new Error("Connection is missing channelId");
    }    
    
    const existingSubscription = this.activeConnections.get(channelId);
    const player = this.getPlayer();
    if (!player) {
      return null;
    }

    player.on("unsubscribe", (subs) => {
      player.removeAllListeners()
      this.availablePlayers.push(player)
      this.activeConnections.delete(subs.connection.joinConfig.channelId!)
    });
    player.on("stateChange", (o, n) => {
      if (n.status === AudioPlayerStatus.Idle) {
        const connectionInfo = this.activeConnections.get(channelId)
        if (connectionInfo) {
          if (connectionInfo.disconnectTimer) {
            clearTimeout(connectionInfo.disconnectTimer)
          }
          connectionInfo.disconnectTimer = setTimeout(
            () => {
              connectionInfo.subscription.unsubscribe()
              connectionInfo.subscription.connection.disconnect();
            }, 
            this.disconnectTimeoutMs)
        }
      }
    });
    player.on("error", console.warn)


    const subscription = connection.subscribe(player)
    if (!subscription) {
      player.removeAllListeners()
      this.availablePlayers.push(player);
      throw new Error("Failed to create player subscription. ChannelID:" + connection.joinConfig.channelId);
    }

    if (!existingSubscription) {
      this.activeConnections.set(channelId, {subscription})
    } else {
      if (existingSubscription!.disconnectTimer) {
        clearTimeout(existingSubscription.disconnectTimer);
      }
    }
    return player
  }

  private getPlayer(): AudioPlayer | null {
    if (this.availablePlayers.length > 0) {
      return this.availablePlayers.shift()!
    }

    if (this.totalPlayers < this.maxPlayers) {
      this.totalPlayers++;
      return createAudioPlayer()
    }

    return null;
  }

}