import { useState, useEffect, useCallback, useRef } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import DispatcherVoiceClient from '../../services/voiceClient';
import Modal from '../../components/Modal';

export default function Voice() {
  const { activeDepartment } = useDepartment();
  const { getToken } = useAuth();
  const [channels, setChannels] = useState([]);
  const [pendingCalls, setPendingCalls] = useState([]);
  const [activeCalls, setActiveCalls] = useState([]);
  const [voiceClient] = useState(() => new DispatcherVoiceClient());
  const [isConnected, setIsConnected] = useState(false);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;

  // Fetch channels and calls
  const fetchData = useCallback(async () => {
    if (!deptId || !isDispatch) return;
    try {
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
    }
  }, [deptId, isDispatch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Real-time updates
  useEventSource({
    'voice:join': () => fetchData(),
    'voice:leave': () => fetchData(),
    'voice:call_accepted': () => fetchData(),
    'voice:call_declined': () => fetchData(),
    'voice:call_ended': () => fetchData(),
  });

  // Initialize voice client
  useEffect(() => {
    if (!isDispatch) return;

    // Set up voice client callbacks
    voiceClient.onConnectionChange = (connected) => {
      setIsConnected(connected);
      if (!connected) {
        setCurrentChannel(null);
        setIsPTTActive(false);
      }
    };

    voiceClient.onChannelChange = (channelNumber) => {
      setCurrentChannel(channelNumber);
    };

    voiceClient.onError = (errorMsg) => {
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    };

    voiceClient.onTalkingChange = (talking) => {
      setIsPTTActive(talking);
    };

    // Auto-connect on mount
    const token = getToken();
    if (token) {
      voiceClient.connect(token).catch(err => {
        console.error('Failed to connect to voice bridge:', err);
        setError('Failed to connect to voice server. Voice features are unavailable.');
      });
    }

    return () => {
      voiceClient.disconnect();
    };
  }, [isDispatch, getToken, voiceClient]);

  // PTT keyboard shortcut
  useEffect(() => {
    if (!currentChannel) return;

    const handleKeyDown = (e) => {
      // Space bar for PTT
      if (e.code === 'Space' && !e.repeat && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        voiceClient.setPushToTalk(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        voiceClient.setPushToTalk(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [currentChannel, voiceClient]);

  // Join channel
  async function joinChannel(channelId, channelNumber) {
    try {
      await api.post(`/api/voice/channels/${channelId}/join`);
      await voiceClient.joinChannel(channelNumber);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to join channel');
      setTimeout(() => setError(null), 5000);
    }
  }

  // Leave channel
  async function leaveChannel(channelId) {
    try {
      await api.post(`/api/voice/channels/${channelId}/leave`);
      await voiceClient.leaveChannel();
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to leave channel');
      setTimeout(() => setError(null), 5000);
    }
  }

  // Accept call
  async function acceptCall(callId) {
    try {
      const result = await api.post(`/api/voice/calls/${callId}/accept`);
      // Join call channel automatically
      if (result.call_channel_number) {
        await voiceClient.joinChannel(result.call_channel_number);
      }
      setSelectedCall(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to accept call');
      setTimeout(() => setError(null), 5000);
    }
  }

  // Decline call
  async function declineCall(callId) {
    try {
      await api.post(`/api/voice/calls/${callId}/decline`);
      setSelectedCall(null);
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to decline call');
      setTimeout(() => setError(null), 5000);
    }
  }

  // End active call
  async function endCall(callId) {
    try {
      await api.post(`/api/voice/calls/${callId}/end`);
      await voiceClient.leaveChannel();
      fetchData();
    } catch (err) {
      setError(err.message || 'Failed to end call');
      setTimeout(() => setError(null), 5000);
    }
  }

  if (!isDispatch) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-cad-muted">
          <p>Voice features are only available for dispatch departments.</p>
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
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-cad-muted">
              {isConnected ? 'Connected' : 'Disconnected'}
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

      {/* Error banner */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Radio Channels */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
            Radio Channels ({channels.length})
          </h3>
          <div className="space-y-3">
            {channels.map(channel => {
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
                        disabled={!isConnected}
                        className="px-3 py-1 text-xs bg-cad-accent/10 text-cad-accent border border-cad-accent/30 rounded hover:bg-cad-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Join
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
            })}
            {channels.length === 0 && (
              <div className="text-center py-12 text-cad-muted">
                No radio channels available
              </div>
            )}
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
