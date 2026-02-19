import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import DispatcherVoiceClient from '../../services/voiceClient';
import ExternalVoiceClient from '../../services/externalVoiceClient';
import Modal from '../../components/Modal';

export default function Voice() {
  const { activeDepartment } = useDepartment();
  const [channels, setChannels] = useState([]);
  const [pendingCalls, setPendingCalls] = useState([]);
  const [activeCalls, setActiveCalls] = useState([]);
  const legacyVoiceClient = useMemo(() => {
    try {
      return new DispatcherVoiceClient();
    } catch (err) {
      console.error('Failed to create DispatcherVoiceClient:', err);
      return null;
    }
  }, []);
  const externalVoiceClient = useMemo(() => {
    try {
      return new ExternalVoiceClient();
    } catch (err) {
      console.error('Failed to create ExternalVoiceClient:', err);
      return null;
    }
  }, []);
  const [isConnected, setIsConnected] = useState(false);
  const [isExternalConnected, setIsExternalConnected] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [voiceMode, setVoiceMode] = useState('legacy');
  const [bridgeIntentionallyDisabled, setBridgeIntentionallyDisabled] = useState(false);
  const [bridgeStatusLoaded, setBridgeStatusLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllChannels, setShowAllChannels] = useState(true);
  const [channelFilter, setChannelFilter] = useState('');
  const [externalTransport, setExternalTransport] = useState(null);
  const [externalSession, setExternalSession] = useState(null);

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;
  const isExternalBehavior = voiceMode === 'external';
  const isExternalRadioOnlyMode = isExternalBehavior && bridgeIntentionallyDisabled === true;
  const isLegacyBridgeDisabled = !isExternalBehavior && bridgeIntentionallyDisabled === true;
  const canUseLegacyBridge = isDispatch && bridgeStatusLoaded && !isExternalBehavior && bridgeIntentionallyDisabled !== true;
  const externalTransportReady = externalTransport?.available === true;
  const currentChannelData = useMemo(() => (
    Number(currentChannel || 0) > 0
      ? (channels.find((channel) => Number(channel?.channel_number || 0) === Number(currentChannel || 0)) || null)
      : null
  ), [channels, currentChannel]);
  const routableParticipantCount = useMemo(() => {
    const participants = Array.isArray(currentChannelData?.participants) ? currentChannelData.participants : [];
    return participants.filter((participant) => String(participant?.game_id || '').trim() !== '').length;
  }, [currentChannelData]);
  const isExternalCallChannel = isExternalBehavior && externalSession?.channelType === 'call';
  const connectionState = isExternalBehavior
    ? (isExternalConnected ? 'connected' : 'disconnected')
    : (isConnected ? 'connected' : 'disconnected');
  const joinedState = Number(currentChannel || 0) > 0 ? 'joined' : 'not joined';
  const receiveState = Number(currentChannel || 0) <= 0
    ? 'idle'
    : (isExternalCallChannel
      ? (isExternalConnected ? 'receiving' : 'idle')
      : (routableParticipantCount > 0 ? 'receiving' : 'no route'));
  const transmitState = Number(currentChannel || 0) <= 0
    ? 'idle'
    : (isPTTActive ? 'transmitting' : 'ready');

  function stateBadgeClass(state) {
    if (state === 'connected' || state === 'joined' || state === 'receiving' || state === 'ready') {
      return 'bg-green-500/10 border-green-500/35 text-green-300';
    }
    if (state === 'transmitting') {
      return 'bg-red-500/10 border-red-500/35 text-red-300';
    }
    if (state === 'external') {
      return 'bg-blue-500/10 border-blue-500/35 text-blue-200';
    }
    if (state === 'no route') {
      return 'bg-yellow-500/10 border-yellow-500/35 text-yellow-300';
    }
    return 'bg-cad-card border-cad-border text-cad-muted';
  }

  // Early return if the required voice client for the current mode failed to initialize.
  if ((isExternalBehavior && !externalVoiceClient) || (!isExternalBehavior && !legacyVoiceClient)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-red-400">
          <p>Failed to initialize voice client for this mode. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  // Fetch channels and calls
  const fetchData = useCallback(async () => {
    if (!deptId || !isDispatch) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [channelsData, pendingCallsData, activeCallsData] = await Promise.all([
        api.get('/api/voice/channels'),
        api.get('/api/voice/calls/pending'),
        api.get('/api/voice/calls/active'),
      ]);
      setChannels(channelsData);
      setPendingCalls(pendingCallsData);
      setActiveCalls(activeCallsData);
    } catch (err) {
      console.error('Failed to load voice data:', err);
      const errorMsg = err?.message || String(err) || 'Unknown error';
      setError(`Failed to load voice data: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  }, [deptId, isDispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchBridgeStatus = useCallback(async () => {
    if (!deptId || !isDispatch) return;
    try {
      const status = await api.get('/api/voice/bridge/status');
      const mode = String(status?.mode || 'legacy').toLowerCase();
      const intentionallyDisabled = !!status?.intentionally_disabled;

      setVoiceMode(mode);
      setBridgeIntentionallyDisabled(intentionallyDisabled);
      setExternalTransport(status?.external_transport || null);

      if (!intentionallyDisabled) {
        setIsConnected(!!status?.available);
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Failed to load voice bridge status:', err);
    } finally {
      setBridgeStatusLoaded(true);
    }
  }, [deptId, isDispatch]);

  useEffect(() => {
    fetchBridgeStatus();
  }, [fetchBridgeStatus]);

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timeoutId = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [error]);

  // Real-time updates
  useEventSource({
    'voice:join': () => fetchData(),
    'voice:leave': () => fetchData(),
    // Refresh when a new 000 call comes in so dispatchers see it immediately
    'voice:call_incoming': () => fetchData(),
    'voice:call_accepted': () => fetchData(),
    'voice:call_declined': () => fetchData(),
    'voice:call_ended': () => fetchData(),
  });

  // Initialize legacy voice bridge client.
  useEffect(() => {
    if (!canUseLegacyBridge || !legacyVoiceClient) return;

    try {
      legacyVoiceClient.onConnectionChange = (connected) => {
        setIsConnected(connected);
        if (!connected) {
          setCurrentChannel(null);
          setIsPTTActive(false);
        }
      };

      legacyVoiceClient.onChannelChange = (channelNumber) => {
        setCurrentChannel(channelNumber);
      };

      legacyVoiceClient.onError = (errorMsg) => {
        setError(errorMsg);
      };

      legacyVoiceClient.onTalkingChange = (talking) => {
        setIsPTTActive(talking);
      };

      legacyVoiceClient.connect('').catch(err => {
        console.error('Failed to connect to voice bridge:', err);
        setError('Failed to connect to voice server. Voice features are unavailable.');
      });

      return () => {
        try {
          legacyVoiceClient.disconnect();
        } catch (err) {
          console.error('Error disconnecting voice client:', err);
        }
      };
    } catch (err) {
      console.error('Error initializing voice client:', err);
      setError('Failed to initialize voice client.');
    }
  }, [canUseLegacyBridge, legacyVoiceClient]);

  // Initialize external voice transport client.
  useEffect(() => {
    if (!isExternalBehavior || !externalVoiceClient) return;

    externalVoiceClient.onConnectionChange = (connected) => {
      setIsExternalConnected(connected);
      if (!connected) setIsPTTActive(false);
    };
    externalVoiceClient.onError = (errorMsg) => {
      setError(errorMsg);
    };
    externalVoiceClient.onTalkingChange = (talking) => {
      setIsPTTActive(talking);
    };

    return () => {
      externalVoiceClient.disconnect().catch((err) => {
        console.error('Error disconnecting external voice client:', err);
      });
      setIsExternalConnected(false);
      setIsPTTActive(false);
    };
  }, [isExternalBehavior, externalVoiceClient]);

  useEffect(() => {
    if (isExternalBehavior) return;
    if (!bridgeIntentionallyDisabled || !legacyVoiceClient) return;
    try {
      legacyVoiceClient.disconnect();
    } catch (err) {
      console.error('Error disconnecting voice client for intentionally-disabled bridge mode:', err);
    }
    setIsConnected(false);
    setCurrentChannel(null);
    setIsPTTActive(false);
    setExternalSession(null);
  }, [bridgeIntentionallyDisabled, isExternalBehavior, legacyVoiceClient]);

  // PTT keyboard shortcut
  useEffect(() => {
    const activeClient = isExternalBehavior ? externalVoiceClient : legacyVoiceClient;
    const canTransmit = isExternalBehavior
      ? (externalTransportReady && isExternalConnected)
      : (canUseLegacyBridge && isConnected && !bridgeIntentionallyDisabled);
    if (!currentChannel || !activeClient || !canTransmit) return;

    const handleKeyDown = (e) => {
      // Space bar for PTT
      const tagName = String(document.activeElement?.tagName || '').toUpperCase();
      if (e.code === 'Space' && !e.repeat && tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (typeof activeClient.setPushToTalk === 'function') {
          Promise.resolve(activeClient.setPushToTalk(true)).catch((err) => {
            console.error('Error setting PTT:', err);
          });
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (typeof activeClient.setPushToTalk === 'function') {
          Promise.resolve(activeClient.setPushToTalk(false)).catch((err) => {
            console.error('Error releasing PTT:', err);
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    bridgeIntentionallyDisabled,
    canUseLegacyBridge,
    currentChannel,
    externalTransportReady,
    isConnected,
    isExternalBehavior,
    isExternalConnected,
    legacyVoiceClient,
    externalVoiceClient,
  ]);

  // Join channel
  const requestExternalToken = useCallback(async (channelId, channelNumber, options = {}) => {
    const payload = {
      channel_id: Number(channelId || 0) || undefined,
      channel_number: Number(channelNumber || 0) || undefined,
      call_session_id: Number(options?.callSessionId || 0) || undefined,
    };
    const result = await api.post('/api/voice/external/token', payload);
    const session = {
      provider: result?.provider || '',
      url: result?.url || '',
      roomName: result?.room_name || '',
      identity: result?.identity || '',
      expiresInSeconds: Number(result?.expires_in_seconds || 0) || 0,
      token: result?.token || '',
      issuedAtMs: Date.now(),
      channelType: result?.channel_type || 'radio',
      channelNumber: Number(result?.channel_number || channelNumber || 0) || 0,
      channelId: Number(result?.channel_id || channelId || 0) || null,
      callSessionId: Number(result?.call_session_id || options?.callSessionId || 0) || null,
    };
    setExternalSession(session);
    if (isExternalBehavior && externalVoiceClient) {
      await externalVoiceClient.connect(session);
    }
    return result;
  }, [externalVoiceClient, isExternalBehavior]);

  async function joinChannel(channelId, channelNumber) {
    try {
      await api.post(`/api/voice/channels/${channelId}/join`);
      if (canUseLegacyBridge && legacyVoiceClient && typeof legacyVoiceClient.joinChannel === 'function') {
        await legacyVoiceClient.joinChannel(channelNumber);
      } else {
        setCurrentChannel(channelNumber);
        setIsPTTActive(false);
        if (isExternalBehavior) {
          await requestExternalToken(channelId, channelNumber);
        }
      }
      fetchData();
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Failed to join channel';
      setError(errorMsg);
    }
  }

  // Leave channel
  async function leaveChannel(channelId) {
    try {
      await api.post(`/api/voice/channels/${channelId}/leave`);
      if (canUseLegacyBridge && legacyVoiceClient && typeof legacyVoiceClient.leaveChannel === 'function') {
        await legacyVoiceClient.leaveChannel();
      }
      if (isExternalBehavior && externalVoiceClient) {
        await externalVoiceClient.disconnect();
      }
      setCurrentChannel(null);
      setIsPTTActive(false);
      setExternalSession(null);
      fetchData();
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Failed to leave channel';
      setError(errorMsg);
    }
  }

  // Accept call
  async function acceptCall(callId) {
    try {
      const result = await api.post(`/api/voice/calls/${callId}/accept`);
      if (result?.call_channel_number && canUseLegacyBridge && legacyVoiceClient && typeof legacyVoiceClient.joinChannel === 'function') {
        await legacyVoiceClient.joinChannel(result.call_channel_number);
      } else if (result?.call_channel_number) {
        setCurrentChannel(result.call_channel_number);
        setIsPTTActive(false);
        if (isExternalBehavior) {
          await requestExternalToken(null, result.call_channel_number, {
            callSessionId: result?.id || callId,
          });
        }
      }
      setSelectedCall(null);
      fetchData();
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Failed to accept call';
      setError(errorMsg);
    }
  }

  // Decline call
  async function declineCall(callId) {
    try {
      await api.post(`/api/voice/calls/${callId}/decline`);
      setSelectedCall(null);
      fetchData();
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Failed to decline call';
      setError(errorMsg);
    }
  }

  // End active call
  async function endCall(callId) {
    try {
      await api.post(`/api/voice/calls/${callId}/end`);
      if (canUseLegacyBridge && legacyVoiceClient && typeof legacyVoiceClient.leaveChannel === 'function') {
        await legacyVoiceClient.leaveChannel();
      }
      if (isExternalBehavior && externalVoiceClient) {
        await externalVoiceClient.disconnect();
      }
      setCurrentChannel(null);
      setIsPTTActive(false);
      setExternalSession(null);
      fetchData();
    } catch (err) {
      const errorMsg = err?.message || String(err) || 'Failed to end call';
      setError(errorMsg);
    }
  }

  if (!isDispatch) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-cad-muted">
          <p className="mb-2">Voice features are only available for dispatch departments.</p>
          <p className="text-xs">Current department: {activeDepartment?.name || 'None'}</p>
          <p className="text-xs">is_dispatch flag: {activeDepartment?.is_dispatch ? 'Yes' : 'No'}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-cad-muted">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cad-accent mx-auto mb-2"></div>
          <p>Loading voice radio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Voice Radio</h2>
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-cad-card border border-cad-border">
            <div className={`w-2 h-2 rounded-full ${isExternalRadioOnlyMode
              ? (isExternalConnected ? 'bg-green-500 animate-pulse' : 'bg-blue-500')
              : (isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500')}`}
            />
            <span className="text-xs font-medium">
              {isExternalRadioOnlyMode
                ? (isExternalConnected ? 'External Voice Connected' : 'External Radio Mode')
                : (isConnected ? 'Voice Bridge Connected' : 'Voice Bridge Disconnected')}
            </span>
          </div>
        </div>
        {currentChannel && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cad-accent/20 border border-cad-accent/40">
            <span className="text-sm font-medium text-cad-accent-light">
              Channel {currentChannel}
            </span>
            {isPTTActive && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-300 font-semibold">TRANSMITTING</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className={`px-3 py-2 rounded-lg border text-xs ${stateBadgeClass(connectionState)}`}>
          <p className="uppercase tracking-wide opacity-80">Connected</p>
          <p className="font-semibold">{connectionState}</p>
        </div>
        <div className={`px-3 py-2 rounded-lg border text-xs ${stateBadgeClass(joinedState)}`}>
          <p className="uppercase tracking-wide opacity-80">Joined</p>
          <p className="font-semibold">{joinedState}</p>
        </div>
        <div className={`px-3 py-2 rounded-lg border text-xs ${stateBadgeClass(receiveState)}`}>
          <p className="uppercase tracking-wide opacity-80">Receiving</p>
          <p className="font-semibold">{receiveState}</p>
        </div>
        <div className={`px-3 py-2 rounded-lg border text-xs ${stateBadgeClass(transmitState)}`}>
          <p className="uppercase tracking-wide opacity-80">Transmitting</p>
          <p className="font-semibold">{transmitState}</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Connection help banner */}
      {isExternalRadioOnlyMode && !error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 text-sm">
          <p className="font-medium mb-1">External radio behavior mode enabled</p>
          <p className="text-xs">
            CAD channel membership is active. External transport status:
            {externalTransportReady
              ? ` ready (${externalTransport?.provider || 'configured'})`
              : ` not configured (${externalTransport?.provider || 'none'})`}
          </p>
          {Array.isArray(externalTransport?.missing) && externalTransport.missing.length > 0 && (
            <p className="text-xs mt-1">
              Missing config: {externalTransport.missing.join(', ')}
            </p>
          )}
          {externalSession?.roomName && (
            <p className="text-xs mt-1">
              Session {isExternalConnected ? 'connected' : 'prepared'} for room <span className="font-mono">{externalSession.roomName}</span> as <span className="font-mono">{externalSession.identity || 'unknown'}</span>.
            </p>
          )}
        </div>
      )}
      {!isExternalRadioOnlyMode && !isConnected && !error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
          <p className="font-medium mb-1">Voice bridge not connected</p>
          <p className="text-xs">
            The voice bridge allows you to communicate with in-game units. Select a channel below to join when the connection is established.
          </p>
        </div>
      )}
      {isLegacyBridgeDisabled && !error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
          <p className="font-medium mb-1">Legacy voice bridge disabled</p>
          <p className="text-xs">
            `VOICE_BRIDGE_ENABLED=false` in legacy mode. CAD will not transmit/receive dispatcher audio until the legacy bridge is enabled.
          </p>
        </div>
      )}
      {Number(currentChannel || 0) > 0 && !error && receiveState === 'no route' && !isExternalCallChannel && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm">
          <p className="font-medium mb-1">No routable participants on this channel</p>
          <p className="text-xs">
            Channel {currentChannel} is joined, but CAD currently sees no in-game participants to route audio to.
            Check that players are in the same channel and that voice participant heartbeat is enabled in `cad_bridge`.
          </p>
        </div>
      )}

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Radio Channels */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3 gap-3">
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">
              Radio Channels
            </h3>
            <div className="flex items-center gap-2">
              <input
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                placeholder="Filter channels..."
                className="w-40 px-2 py-1 text-xs rounded border border-cad-border bg-cad-surface text-cad-text placeholder-cad-muted"
              />
              <button
                onClick={() => setShowAllChannels(v => !v)}
                className="text-xs text-cad-muted hover:text-cad-accent transition-colors whitespace-nowrap"
              >
                {showAllChannels ? 'Show active only' : 'Show all'}
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {(() => {
              const sortedChannels = [...channels].sort((a, b) => {
                if (currentChannel === a.channel_number) return -1;
                if (currentChannel === b.channel_number) return 1;
                const byParticipants = Number(b.participant_count || 0) - Number(a.participant_count || 0);
                if (byParticipants !== 0) return byParticipants;
                return Number(a.channel_number || 0) - Number(b.channel_number || 0);
              });
              const activeFiltered = showAllChannels
                ? sortedChannels
                : sortedChannels.filter(c => c.participant_count > 0 || currentChannel === c.channel_number);
              const textFilter = String(channelFilter || '').trim().toLowerCase();
              const visibleChannels = textFilter
                ? activeFiltered.filter((channel) => {
                  const haystack = `${channel.channel_number || ''} ${channel.name || ''} ${channel.description || ''}`.toLowerCase();
                  return haystack.includes(textFilter);
                })
                : activeFiltered;
              return visibleChannels.length > 0 ? visibleChannels.map(channel => {
              const isInChannel = currentChannel === channel.channel_number;
              return (
                <div
                  key={channel.id}
                  className={`bg-cad-surface rounded-lg border p-4 transition-colors ${
                    isInChannel
                      ? 'border-cad-accent bg-cad-accent/5'
                      : 'border-cad-border hover:border-cad-border-light'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-cad-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                      </svg>
                      <span className="font-semibold">Channel {channel.channel_number}</span>
                      <span className="text-cad-muted">-</span>
                      <span className="text-sm">{channel.name}</span>
                    </div>
                    {isInChannel ? (
                      <button
                        onClick={() => leaveChannel(channel.id)}
                        className="px-3 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                      >
                        Leave
                      </button>
                    ) : (
                      <button
                        onClick={() => joinChannel(channel.id, channel.channel_number)}
                        disabled={!isConnected && !bridgeIntentionallyDisabled}
                        className="px-3 py-1 text-xs bg-cad-accent/10 text-cad-accent border border-cad-accent/30 rounded hover:bg-cad-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {currentChannel ? 'Switch' : 'Join'}
                      </button>
                    )}
                  </div>
                  {channel.description && (
                    <p className="text-xs text-cad-muted mb-2">{channel.description}</p>
                  )}
                  {/* Participants */}
                  <div className="mt-2">
                    <p className="text-xs text-cad-muted mb-1">
                      Participants ({channel.participants?.length || 0})
                    </p>
                    {channel.participants && channel.participants.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {channel.participants.map(participant => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-cad-card border border-cad-border text-xs"
                          >
                            <span>{participant.user_name || participant.citizen_id || 'Unknown'}</span>
                            {participant.is_talking && (
                              <svg className="w-3 h-3 text-green-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-cad-muted italic">No participants</p>
                    )}
                  </div>
                </div>
              );
              }) : (
                <div className="text-center py-12">
                  <div className="bg-cad-surface rounded-lg border border-cad-border p-6 max-w-md mx-auto">
                    <svg className="w-12 h-12 text-cad-muted mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                    {String(channelFilter || '').trim() ? (
                      <>
                        <p className="text-cad-muted font-medium mb-2">No channels match your filter</p>
                        <button
                          onClick={() => setChannelFilter('')}
                          className="text-xs text-cad-accent hover:underline"
                        >
                          Clear filter
                        </button>
                      </>
                    ) : showAllChannels ? (
                      <>
                        <p className="text-cad-muted font-medium mb-2">No radio channels configured</p>
                        <p className="text-xs text-cad-muted mb-3">
                          Voice channels need to be created by an administrator.
                        </p>
                        <p className="text-xs text-cad-accent">Admin -&gt; System Settings -&gt; Voice Channels</p>
                      </>
                    ) : (
                      <>
                        <p className="text-cad-muted font-medium mb-2">No active channels</p>
                        <p className="text-xs text-cad-muted mb-3">
                          No in-game units are currently on any radio channel.
                        </p>
                        <button
                          onClick={() => setShowAllChannels(true)}
                          className="text-xs text-cad-accent hover:underline"
                        >
                          Show all channels
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Call Management Panel */}
        <div className="w-80 flex-shrink-0 overflow-y-auto space-y-4">
          {/* Pending 000 Calls */}
          <div>
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
              Pending 000 Calls ({pendingCalls.length})
            </h3>
            {pendingCalls.length > 0 ? (
              <div className="space-y-2">
                {pendingCalls.map(call => (
                  <div
                    key={call.id}
                    className="bg-cad-surface rounded-lg border border-red-500/35 p-3 hover:border-red-500/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCall(call)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-sm font-semibold text-red-300">Call #{call.id}</span>
                    </div>
                    <p className="text-xs text-cad-muted">
                      {call.caller_name || call.caller_citizen_id || 'Unknown caller'}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          acceptCall(call.id);
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/30 rounded hover:bg-green-500/20 transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          declineCall(call.id);
                        }}
                        className="flex-1 px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-cad-muted py-4 text-center">No pending calls</p>
            )}
          </div>

          {/* Active Calls */}
          <div>
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
              Active Calls ({activeCalls.length})
            </h3>
            {activeCalls.length > 0 ? (
              <div className="space-y-2">
                {activeCalls.map(call => (
                  <div
                    key={call.id}
                    className="bg-cad-surface rounded-lg border border-cad-accent/35 p-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-4 h-4 text-cad-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <span className="text-sm font-semibold">Call #{call.id}</span>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-auto" />
                    </div>
                    <p className="text-xs text-cad-muted mb-2">
                      {call.caller_name || call.caller_citizen_id || 'Unknown caller'}
                    </p>
                    <button
                      onClick={() => endCall(call.id)}
                      className="w-full px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                    >
                      End Call
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-cad-muted py-4 text-center">No active calls</p>
            )}
          </div>

          {/* PTT Instructions */}
          {currentChannel && (
            <div className="px-3 py-2 rounded-lg bg-cad-card border border-cad-border">
              <p className="text-xs text-cad-muted mb-1">Push-to-Talk Controls:</p>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-0.5 text-xs bg-cad-surface border border-cad-border rounded">Space</kbd>
                <span className="text-xs text-cad-muted">Hold to transmit</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call Details Modal */}
      <Modal
        open={!!selectedCall}
        onClose={() => setSelectedCall(null)}
        title={`000 Call #${selectedCall?.id}`}
      >
        {selectedCall && (
          <div className="space-y-3">
            <div>
              <p className="text-sm text-cad-muted">Caller</p>
              <p className="text-base">{selectedCall.caller_name || selectedCall.caller_citizen_id || 'Unknown'}</p>
            </div>
            {selectedCall.call_id && (
              <div>
                <p className="text-sm text-cad-muted">Call ID</p>
                <p className="text-base font-mono">#{selectedCall.call_id}</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => acceptCall(selectedCall.id)}
                className="flex-1 px-4 py-2 bg-green-500/10 text-green-400 border border-green-500/30 rounded hover:bg-green-500/20 transition-colors"
              >
                Accept Call
              </button>
              <button
                onClick={() => declineCall(selectedCall.id)}
                className="flex-1 px-4 py-2 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
