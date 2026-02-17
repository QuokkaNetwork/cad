import { useEffect, useRef } from 'react';
import { useEventSourceContext } from '../context/EventSourceContext';

/**
 * Subscribe to SSE events from the shared global SSE connection.
 * Pass an object mapping event names to handler functions.
 * Handlers are updated on every render via a ref so they're always current
 * without needing to re-subscribe.
 */
export function useEventSource(eventHandlers) {
  const { on, off } = useEventSourceContext();
  const handlersRef = useRef(eventHandlers);
  handlersRef.current = eventHandlers;

  useEffect(() => {
    // For each event key, register a stable wrapper that calls the latest handler
    const wrappers = {};
    for (const event of Object.keys(handlersRef.current)) {
      wrappers[event] = (data) => {
        if (handlersRef.current[event]) {
          handlersRef.current[event](data);
        }
      };
      on(event, wrappers[event]);
    }

    return () => {
      for (const event of Object.keys(wrappers)) {
        off(event, wrappers[event]);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps — wrappers are registered once, handlers stay current via ref
}
