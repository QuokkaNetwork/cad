import { useEffect, useRef, useCallback } from 'react';

export function useEventSource(eventHandlers) {
  const esRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const closedRef = useRef(false);
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  const connect = useCallback(() => {
    if (closedRef.current) return;

    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource('/api/events');
    esRef.current = es;

    es.onopen = () => {
      console.log('SSE connected');
    };

    es.onerror = () => {
      es.close();
      if (closedRef.current) return;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      // Reconnect after 5 seconds
      reconnectTimerRef.current = setTimeout(connect, 5000);
    };

    // Register handlers for each event type
    const events = [
      'unit:online', 'unit:offline', 'unit:update',
      'call:create', 'call:update', 'call:close', 'call:assign', 'call:unassign',
      'bolo:create', 'bolo:resolve', 'bolo:cancel',
      'voice:join', 'voice:leave', 'voice:call_accepted', 'voice:call_declined', 'voice:call_ended',
      'announcement:new', 'sync:department',
    ];

    for (const event of events) {
      es.addEventListener(event, (e) => {
        try {
          const data = JSON.parse(e.data);
          if (handlersRef.current[event]) {
            handlersRef.current[event](data);
          }
        } catch {
          // ignore parse errors
        }
      });
    }
  }, []);

  useEffect(() => {
    closedRef.current = false;
    connect();
    return () => {
      closedRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);
}
