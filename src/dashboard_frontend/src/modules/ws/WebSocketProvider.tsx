import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { ViewMessage } from '../harness/types';

type InitialPayload = {
  specs: any[];
  approvals: any[];
};

/** A page's live view: the per-project harness pane, or the global overview. */
export type WatchView =
  | { kind: 'harness'; projectId: string }
  | { kind: 'overview' };

type WsContextType = {
  connected: boolean;
  initial?: InitialPayload;
  subscribe: (eventType: string, handler: (data: any) => void) => void;
  unsubscribe: (eventType: string, handler: (data: any) => void) => void;
  /**
   * Subscribe the socket to a view for as long as at least one caller holds it.
   * The first caller sends the subscribe message; the returned release function,
   * when it drops the last caller, sends the matching unsubscribe. Every held
   * view is re-subscribed after a reconnect.
   */
  watchView: (view: WatchView) => () => void;
};

const WsContext = createContext<WsContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  projectId: string | null;
}

// Reconnection constants
const MAX_RETRY_DELAY = 30000;
const INITIAL_RETRY_DELAY = 1000;

function viewKey(view: WatchView): string {
  return view.kind === 'harness' ? `harness:${view.projectId}` : 'overview';
}

function subscribeMessage(view: WatchView): ViewMessage {
  return view.kind === 'harness'
    ? { type: 'harness-subscribe', projectId: view.projectId }
    : { type: 'overview-subscribe' };
}

function unsubscribeMessage(view: WatchView): ViewMessage {
  return view.kind === 'harness'
    ? { type: 'harness-unsubscribe', projectId: view.projectId }
    : { type: 'overview-unsubscribe' };
}

export function WebSocketProvider({ children, projectId }: WebSocketProviderProps) {
  const [connected, setConnected] = useState(false);
  const [initial, setInitial] = useState<InitialPayload | undefined>(undefined);
  const wsRef = useRef<WebSocket | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const retryTimerRef = useRef<any>(null);
  const currentProjectIdRef = useRef<string | null>(null);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  // Reference count per view key; the descriptor is kept so onopen can re-subscribe.
  const viewsRef = useRef<Map<string, { view: WatchView; count: number }>>(new Map());

  const connectToWebSocket = useCallback((targetProjectId: string | null) => {
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnection
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear any pending retry
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Build WebSocket URL with projectId query parameter
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = targetProjectId
      ? `${protocol}//${location.host}/ws?projectId=${encodeURIComponent(targetProjectId)}`
      : `${protocol}//${location.host}/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    currentProjectIdRef.current = targetProjectId;

    ws.onopen = () => {
      setConnected(true);
      // Reset retry delay on successful connection
      retryDelayRef.current = INITIAL_RETRY_DELAY;
      // Re-subscribe every view that still has users, so a reconnect restores them.
      viewsRef.current.forEach(({ view }) => {
        ws.send(JSON.stringify(subscribeMessage(view)));
      });
    };

    ws.onclose = (event) => {
      setConnected(false);

      // Don't reconnect on clean close (code 1000) or going away (code 1001)
      if (event.code === 1000 || event.code === 1001) {
        return;
      }

      // Only retry if we're still on the same project
      if (currentProjectIdRef.current === targetProjectId) {
        retryTimerRef.current = setTimeout(() => {
          connectToWebSocket(targetProjectId);
        }, retryDelayRef.current);

        // Exponential backoff for next retry
        retryDelayRef.current = Math.min(retryDelayRef.current * 1.5, MAX_RETRY_DELAY);
      }
    };

    ws.onerror = () => {
      // noop; close will handle retry
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);

        // Handle initial message
        if (msg.type === 'initial' && msg.projectId === targetProjectId) {
          setInitial({ specs: msg.data?.specs || [], approvals: msg.data?.approvals || [] });
        }
        // Handle projects-update (global message)
        else if (msg.type === 'projects-update') {
          const handlers = eventHandlersRef.current.get('projects-update');
          if (handlers) {
            handlers.forEach(handler => handler(msg.data));
          }
        }
        // Handle the global overview messages by type, with no project check.
        else if (msg.type === 'overview-rows' || msg.type === 'overview-todos') {
          const handlers = eventHandlersRef.current.get(msg.type);
          if (handlers) {
            handlers.forEach(handler => handler(msg.data));
          }
        }
        // Handle project-scoped messages (including harness-*, which carry projectId)
        else if (msg.projectId === targetProjectId) {
          const handlers = eventHandlersRef.current.get(msg.type);
          if (handlers) {
            handlers.forEach(handler => handler(msg.data));
          }
        }
      } catch {
        // ignore
      }
    };
  }, []);

  // Connect/reconnect when projectId changes
  useEffect(() => {
    if (projectId) {
      // Clear initial data when switching projects
      setInitial(undefined);
      // Reset retry delay when switching projects
      retryDelayRef.current = INITIAL_RETRY_DELAY;
      connectToWebSocket(projectId);
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [projectId, connectToWebSocket]);

  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (!eventHandlersRef.current.has(eventType)) {
      eventHandlersRef.current.set(eventType, new Set());
    }
    eventHandlersRef.current.get(eventType)!.add(handler);
  }, []);

  const unsubscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    const handlers = eventHandlersRef.current.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        eventHandlersRef.current.delete(eventType);
      }
    }
  }, []);

  const sendView = useCallback((msg: ViewMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  const watchView = useCallback((view: WatchView) => {
    const key = viewKey(view);
    const entry = viewsRef.current.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      viewsRef.current.set(key, { view, count: 1 });
      // First user of this view: subscribe now if the socket is open; onopen
      // re-sends it after a reconnect.
      sendView(subscribeMessage(view));
    }
    return () => {
      const held = viewsRef.current.get(key);
      if (!held) return;
      held.count -= 1;
      if (held.count <= 0) {
        viewsRef.current.delete(key);
        sendView(unsubscribeMessage(view));
      }
    };
  }, [sendView]);

  const value = useMemo(() => ({
    connected,
    initial,
    subscribe,
    unsubscribe,
    watchView
  }), [connected, initial, subscribe, unsubscribe, watchView]);

  return <WsContext.Provider value={value}>{children}</WsContext.Provider>;
}

export function useWs(): WsContextType {
  const ctx = useContext(WsContext);
  if (!ctx) throw new Error('useWs must be used within WebSocketProvider');
  return ctx;
}


