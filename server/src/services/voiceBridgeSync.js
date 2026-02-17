/**
 * Voice Bridge Synchronization
 *
 * This module keeps the voice bridge routing table in sync with the current
 * state of voice participants in each channel. It ensures dispatchers can
 * communicate with the correct in-game players based on channel membership.
 *
 * Periodic tasks (started in initVoiceBridgeSync):
 *   - Full route sync every 30 s — picks up any missed join/leave events.
 *   - Stale participant prune every 60 s — removes FiveM players whose
 *     last_activity_at is older than 3 minutes (covers FiveM resource restarts
 *     that don't fire leave events). Emits voice:leave SSE events so the CAD
 *     UI updates without needing a server restart.
 */

const { VoiceParticipants, VoiceChannels } = require('../db/sqlite');
const bus = require('../utils/eventBus');

const PERIODIC_SYNC_MS   = 30_000;  // full route sync interval
const PRUNE_INTERVAL_MS  = 60_000;  // stale participant scan interval
const STALE_THRESHOLD_S  = 180;     // remove game participants inactive > 3 min

let voiceBridgeInstance = null;
let syncTimer  = null;
let pruneTimer = null;

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

  // Initial sync
  syncAllChannelRoutes();

  // Periodic full sync so the routing table stays current even if events are missed
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(() => {
    syncAllChannelRoutes();
  }, PERIODIC_SYNC_MS);
  syncTimer.unref?.(); // Don't block process exit

  // Periodic stale-participant prune
  if (pruneTimer) clearInterval(pruneTimer);
  pruneTimer = setInterval(() => {
    pruneStaleParticipants();
  }, PRUNE_INTERVAL_MS);
  pruneTimer.unref?.();
}

/**
 * Remove in-game participants whose last_activity_at is older than STALE_THRESHOLD_S.
 * Emits voice:leave SSE events so CAD clients update their channel participant lists.
 */
function pruneStaleParticipants() {
  try {
    const removed = VoiceParticipants.removeStaleGameParticipants(STALE_THRESHOLD_S);
    if (removed.length === 0) return;

    // Collect unique channel numbers that changed
    const affectedChannels = new Set();
    for (const row of removed) {
      const chNum = Number(row.channel_number);
      bus.emit('voice:leave', {
        channelId: row.channel_id,
        channelNumber: chNum,
        userId: row.user_id || null,
        gameId: String(row.game_id || ''),
        citizenId: String(row.citizen_id || ''),
        staleEviction: true,
      });
      if (chNum > 0) affectedChannels.add(chNum);
    }

    console.log(`[VoiceBridgeSync] Pruned ${removed.length} stale game participant(s) from channels: ${[...affectedChannels].join(', ')}`);

    // Re-sync routing for affected channels
    syncAllChannelRoutes();
  } catch (err) {
    console.error('[VoiceBridgeSync] Error pruning stale participants:', err);
  }
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
  pruneStaleParticipants,
  getRoutingStatus,
};
