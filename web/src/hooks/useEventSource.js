import { useEffect, useRef, useCallback } from 'react';
import { getToken } from '../api/client';

export function useEventSource(eventHandlers) {
  const esRef = useRef(null);
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) return;

    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.onopen = () => {
      console.log('SSE connected');
    };

    es.onerror = () => {
      es.close();
      // Reconnect after 5 seconds
      setTimeout(connect, 5000);
    };

    // Register handlers for each event type
    const events = [
      'unit:online', 'unit:offline', 'unit:update',
      'call:create', 'call:update', 'call:close', 'call:assign', 'call:unassign',
      'bolo:create', 'bolo:resolve', 'bolo:cancel',
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
    connect();
    return () => {
      if (esRef.current) {
        esRef.current.close();
      }
    };
  }, [connect]);
}
