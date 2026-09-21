'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseWebSocketOptions {
  url: string;
  enabled: boolean;
  onMessage?: (data: unknown) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({
  url,
  enabled,
  onMessage,
  onConnect,
  onDisconnect
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use refs for callbacks to avoid re-triggering effect
  const callbacksRef = useRef({ onMessage, onConnect, onDisconnect });
  useEffect(() => {
    callbacksRef.current = { onMessage, onConnect, onDisconnect };
  }, [onMessage, onConnect, onDisconnect]);

  const connect = useCallback(() => {
    if (!url || typeof window === 'undefined') return;
    
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
        if (callbacksRef.current.onConnect) {
          callbacksRef.current.onConnect();
        }

        // Setup ping interval (30s)
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (callbacksRef.current.onMessage) {
            callbacksRef.current.onMessage(data);
          }
        } catch {
          // If not JSON, just pass the raw data or ignore
          if (callbacksRef.current.onMessage) {
            callbacksRef.current.onMessage(event.data);
          }
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        
        if (callbacksRef.current.onDisconnect) {
          callbacksRef.current.onDisconnect();
        }

        // Auto-reconnect if still enabled
        if (enabled) {
          const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current += 1;
          reconnectTimeoutRef.current = setTimeout(connect, backoff);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        // onclose will be called after onerror, handling the reconnect
      };
    } catch (e) {
      console.error('WebSocket connection failed:', e);
    }
  }, [url, enabled]);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect loop on unmount
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [enabled, connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      wsRef.current.send(message);
    } else {
      console.warn('WebSocket is not connected. Cannot send data.');
    }
  }, []);

  const reconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  return { send, isConnected, reconnect };
}
