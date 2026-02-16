/**
 * Voice Bridge Synchronization
 *
 * This module keeps the voice bridge routing table in sync with the current
 * state of voice participants in each channel. It ensures dispatchers can
 * communicate with the correct in-game players based on channel membership.
 */

const { VoiceParticipants, VoiceChannels } = require('../db/sqlite');

let voiceBridgeInstance = null;

/**
 * Initialize the voice bridge sync system
 * @param {Object} voiceBridge - The voice bridge instance from getVoiceBridge()
 */
function initVoiceBridgeSync(voiceBridge) {
  if (!voiceBridge || !voiceBridge.available) {
    console.log('[VoiceBridgeSync] Voice bridge not available, sync disabled');
    return;
  }
  voiceBridgeInstance = voiceBridge;
  console.log('[VoiceBridgeSync] Voice bridge sync initialized');

  // Do initial sync
  syncAllChannelRoutes();
}

/**
 * Build routing map from current participant state
 * Returns: Map<channelNumber, Array<gameId>>
 */
function buildRoutingMapFromParticipants() {
  const routingMap = new Map();

  try {
    const channels = VoiceChannels.list();

    for (const channel of channels) {
      if (!channel.is_active) continue;

      const channelNumber = Number(channel.channel_number);
      if (!channelNumber || channelNumber <= 0) continue;

      const participants = VoiceParticipants.listByChannel(channel.id);
      const gameIds = [];

      for (const participant of participants) {
        const gameId = String(participant.game_id || '').trim();
        if (gameId) {
          // Convert game_id to number for Mumble channel ID targeting
          const numericGameId = parseInt(gameId, 10);
          if (!isNaN(numericGameId) && numericGameId > 0) {
            gameIds.push(numericGameId);
          }
        }
      }

      if (gameIds.length > 0) {
        routingMap.set(channelNumber, gameIds);
      }
    }
  } catch (error) {
    console.error('[VoiceBridgeSync] Error building routing map:', error);
  }

  return routingMap;
}

/**
 * Sync all channel routes to the voice bridge
 */
function syncAllChannelRoutes() {
  if (!voiceBridgeInstance) return;

  try {
    const routingMap = buildRoutingMapFromParticipants();
    voiceBridgeInstance.setRouteMembersByChannel(routingMap);

    const totalChannels = routingMap.size;
    let totalTargets = 0;
    for (const targets of routingMap.values()) {
      totalTargets += targets.length;
    }

    console.log(`[VoiceBridgeSync] Synced ${totalChannels} channels with ${totalTargets} total targets`);
  } catch (error) {
    console.error('[VoiceBridgeSync] Error syncing all channel routes:', error);
  }
}

/**
 * Sync routing for a specific channel
 * @param {number} channelNumber - The channel number to sync
 */
function syncChannelRoute(channelNumber) {
  if (!voiceBridgeInstance) return;

  try {
    const routingMap = buildRoutingMapFromParticipants();
    voiceBridgeInstance.setRouteMembersByChannel(routingMap);

    const channelTargets = routingMap.get(channelNumber) || [];
    console.log(`[VoiceBridgeSync] Synced channel ${channelNumber} with ${channelTargets.length} targets`);
  } catch (error) {
    console.error('[VoiceBridgeSync] Error syncing channel route:', error);
  }
}

/**
 * Handle a participant joining a channel
 * @param {number} channelNumber - The channel number
 */
function handleParticipantJoin(channelNumber) {
  syncChannelRoute(channelNumber);
}

/**
 * Handle a participant leaving a channel
 * @param {number} channelNumber - The channel number
 */
function handleParticipantLeave(channelNumber) {
  syncChannelRoute(channelNumber);
}

/**
 * Get current routing status (for debugging)
 */
function getRoutingStatus() {
  const routingMap = buildRoutingMapFromParticipants();
  const status = {
    available: !!voiceBridgeInstance,
    channels: [],
  };

  for (const [channelNumber, gameIds] of routingMap.entries()) {
    status.channels.push({
      channelNumber,
      targetCount: gameIds.length,
      targets: gameIds,
    });
  }

  return status;
}

module.exports = {
  initVoiceBridgeSync,
  syncAllChannelRoutes,
  syncChannelRoute,
  handleParticipantJoin,
  handleParticipantLeave,
  getRoutingStatus,
};
