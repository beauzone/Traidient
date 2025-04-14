import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, type AuthUser } from './useAuth';

interface WebSocketError {
  type: string;
  message: string;
  [key: string]: any;
}

interface WebSocketOptions {
  onMessage?: (data: any) => void;
  onError?: (error: WebSocketError) => void;
  autoReconnect?: boolean;
  includeAuthToken?: boolean;
  pingInterval?: number;
  maxReconnectAttempts?: number;
  fallbackMechanism?: 'http' | 'polling' | 'none';
}

export const useWebSocket = (
  path: string, 
  options: WebSocketOptions = {}
): { 
  socket: WebSocket | null,
  send: (data: any) => void,
  connected: boolean,
  reconnect: () => void
} => {
  const { 
    autoReconnect = true, 
    onMessage, 
    onError,
    includeAuthToken = true,
    pingInterval = 30000,  // Default ping every 30 seconds to keep connection alive
    maxReconnectAttempts: userMaxReconnectAttempts = 10,
    fallbackMechanism = 'http'
  } = options;

  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = userMaxReconnectAttempts;
  const baseReconnectDelay = 1000;
  const { user, isAuthenticated } = useAuth();
  const socketRef = useRef<WebSocket | null>(null);

  // Enhanced WebSocket URL construction with specific Replit support
  const getWebSocketUrl = useCallback(() => {
    try {
      // Start by capturing the current origin and URL information
      const location = window.location;
      const isSecure = location.protocol === 'https:';
      const protocol = isSecure ? 'wss:' : 'ws:';
      const host = location.host; // host includes hostname:port if port is specified

      // Add a cache-busting parameter to avoid caching issues with specific timestamp
      const cacheBuster = `_cb=${Date.now()}`;

      // Base path constructed with carefully verified components
      let wsUrl = '';

      // For Replit environments, we have two potential connection approaches:

      // APPROACH 1: Connect to the specific WebSocket endpoint /ws path
      // This is the standard approach that connects to our dedicated WebSocket route
      // IMPORTANT: Don't add any port specification - let the browser handle it based on host
      wsUrl = `${protocol}//${host}/ws?${cacheBuster}`;

      // Log the detailed location information for troubleshooting
      console.log('WebSocket connection details:', {
        protocol: location.protocol,
        wsProtocol: protocol,
        host: location.host, 
        hostname: location.hostname,
        port: location.port || '(default)', // Show default if no port specified
        origin: location.origin,
        href: location.href,
        constructedUrl: wsUrl,
        replitEnv: {
          isProd: location.hostname.includes('.replit.app'),
          isDev: location.hostname.includes('.repl.co'),
          isLocal: location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        }
      });

      // Include authentication parameters if required
      if (includeAuthToken && isAuthenticated && user) {
        // Standard: append userId parameter for server-side validation
        wsUrl += `&userId=${user.id}`;

        // Include token from localStorage if available
        const token = localStorage.getItem('token');
        if (token) {
          wsUrl += `&token=${encodeURIComponent(token)}`;
        }

        // Add additional session verification
        const sessionId = localStorage.getItem('sessionId');
        if (sessionId) {
          wsUrl += `&sessionId=${encodeURIComponent(sessionId)}`;
        }
      }

      // Log the full constructed URL for debugging
      console.log(`WebSocket URL constructed (primary): ${wsUrl}`);
      return wsUrl;
    } catch (error) {
      console.error('Error constructing primary WebSocket URL:', error);

      // ENHANCED FALLBACK STRATEGY FOR REPLIT

      // Get the base information again in a simplified way
      const isSecure = window.location.protocol === 'https:';
      const fallbackProtocol = isSecure ? 'wss:' : 'ws:';

      // Fallback 1: Try simpler URL with host only (includes current port)
      try {
        // Use window.location.host which keeps host:port format
        const timestamp = Date.now();
        const fallbackUrl1 = `${fallbackProtocol}//${window.location.host}/ws?_=${timestamp}`;
        console.log(`Attempting fallback WebSocket URL (1): ${fallbackUrl1}`);
        return fallbackUrl1;
      } catch (err) {
        console.error('Fallback URL 1 construction failed:', err);
      }

      // Fallback 2: Try with hostname only (explicitly no port specification)
      try {
        const timestamp = Date.now();
        const fallbackUrl2 = `${fallbackProtocol}//${window.location.hostname}/ws?_=${timestamp}`;
        console.log(`Attempting fallback WebSocket URL (2): ${fallbackUrl2}`);
        return fallbackUrl2;
      } catch (err) {
        console.error('Fallback URL 2 construction failed:', err);
      }

      // Fallback 3: Try Replit-specific URLs with proper domain detection
      try {
        const hostname = window.location.hostname;
        const timestamp = Date.now();

        // If it's a Replit domain
        if (hostname.includes('.replit.app') || hostname.includes('.repl.co')) {
          // Ensure we don't add :5900 or any explicit port in the URL
          const fallbackUrl3 = `${fallbackProtocol}//${hostname}/ws?_=${timestamp}`;
          console.log(`Attempting Replit-specific WebSocket URL: ${fallbackUrl3}`);
          return fallbackUrl3;
        }
      } catch (err) {
        console.error('Replit-specific fallback failed:', err);
      }

      // Last resort: absolute basic URL with minimal construction
      const timestamp = Date.now();
      const finalFallback = isSecure ? 
        `wss://${window.location.hostname}/ws?_=${timestamp}` : 
        `ws://${window.location.hostname}/ws?_=${timestamp}`;
      console.log(`Using ultimate fallback WebSocket URL: ${finalFallback}`);
      return finalFallback;
    }
  }, [includeAuthToken, isAuthenticated, user]);

  // Function to send data through the WebSocket
  const send = useCallback((data: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      try {
        // Convert data to JSON string if it's not already a string
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        socketRef.current.send(message);
        return true;
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        return false;
      }
    } else {
      console.warn('Cannot send message: WebSocket is not connected');
      return false;
    }
  }, []);

  // Function to manually reconnect
  const reconnect = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close();
    }

    // Reset reconnect attempts to start fresh
    reconnectAttempts.current = 0;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Schedule immediate reconnection
    setTimeout(connectWebSocket, 100);
  }, []);

  // Function to send ping to keep connection alive
  const sendPing = useCallback(() => {
    if (connected && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      console.log('Sending ping to keep WebSocket connection alive');
      send({ type: 'ping', timestamp: Date.now() });
    } else if (connected && (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN)) {
      console.warn('WebSocket appears connected in state but socket is not open. Attempting reconnection.');
      reconnect();
    }
  }, [connected, send, reconnect]);

  // Initialize ping interval
  useEffect(() => {
    if (connected && pingInterval > 0) {
      pingIntervalRef.current = setInterval(sendPing, pingInterval);
    }

    return () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [connected, pingInterval, sendPing]);

  // Enhanced WebSocket connection with Replit compatibility and better diagnostics
  const connectWebSocket = useCallback(() => {
    try {
      // Generate the WebSocket URL with our enhanced algorithm
      const wsUrl = getWebSocketUrl();

      // Logging information for debugging
      console.log(`Attempting WebSocket connection to ${wsUrl}`);

      // Connect with detailed diagnostics
      console.time('WebSocket Connection Attempt');

      // Keep track of connection status for diagnostics
      let connectionInitiated = false;
      let connectionFailed = false;

      try {
        // Create WebSocket with enhanced error handling
        const ws = new WebSocket(wsUrl);
        connectionInitiated = true;
        socketRef.current = ws;

        // Set a connection timeout to detect stalled connections
        const connectionTimeout = setTimeout(() => {
          if (!connectionFailed && ws.readyState !== WebSocket.OPEN) {
            console.warn('WebSocket connection timeout - connection taking too long');
            // We don't close here because the close handler will handle reconnection
          }
        }, 10000); // 10 second timeout

        // Event listeners with improved diagnostics
        ws.addEventListener('open', () => {
          console.timeEnd('WebSocket Connection Attempt');
          clearTimeout(connectionTimeout);
          console.log('WebSocket connected successfully! ReadyState:', ws.readyState);

          // Reset reconnection metrics on successful connection
          reconnectAttempts.current = 0;
          setSocket(ws);
          setConnected(true);

          // Connection verification ping
          console.log('Sending initial ping to verify two-way communication');
          send({ 
            type: 'ping', 
            timestamp: Date.now(),
            client: 'web-app',
            version: '1.0'
          });

          // Enhanced authentication message
          if (isAuthenticated && user && includeAuthToken) {
            console.log('Sending enhanced authentication data to WebSocket server');

            // Get the token from localStorage
            const token = localStorage.getItem('token');

            send({ 
              type: 'auth', 
              userId: user.id,
              token: token, // Include the auth token
              timestamp: Date.now(),
              clientInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                locale: navigator.language
              }
            });

            // Also send a backup authentication in case the first one fails
            setTimeout(() => {
              if (socketRef.current?.readyState === WebSocket.OPEN) {
                console.log('Sending backup authentication message');
                send({
                  type: 'auth_backup',
                  userId: user.id,
                  token: token,
                  timestamp: Date.now()
                });
              }
            }, 1000);
          }
        });

        ws.addEventListener('message', (event) => {
          try {
            // Allow non-JSON messages in certain cases
            if (typeof event.data === 'string') {
              // Handle simple text messages first
              if (event.data === 'pong' || event.data === '{"type":"pong"}') {
                console.log('Received pong confirmation from server');
                return;
              }

              try {
                // Try to parse as JSON with error handling
                const data = JSON.parse(event.data);

                // Special message handling
                if (data.type === 'pong') {
                  console.log('Server responded to ping with pong message');
                  return;
                }

                if (data.type === 'error') {
                  console.error('Server reported WebSocket error:', data.message || data);
                  return;
                }

                if (data.type === 'auth_result') {
                  console.log('Authentication result:', data.success ? 'Success' : 'Failed', data.message || '');
                  return;
                }

                // For all other messages, pass to the callback
                if (onMessage) {
                  onMessage(data);
                }
              } catch (jsonError) {
                // If it's not valid JSON, still send the raw message to the callback
                console.warn('Received non-JSON message from WebSocket:', event.data);
                if (onMessage) {
                  onMessage(event.data);
                }
              }
            } else {
              // Handle binary data if needed
              console.log('Received binary WebSocket message');
              if (onMessage) {
                onMessage(event.data);
              }
            }
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
            console.log('Problem message was:', event.data);
          }
        });

        ws.addEventListener('close', (event) => {
          console.timeEnd('WebSocket Connection Attempt');
          clearTimeout(connectionTimeout);
          connectionFailed = true;

          // Comprehensive WebSocket close code explanations
          const closeCodes = {
            1000: 'Normal Closure (successful operation/explicit termination)',
            1001: 'Going Away (server shutting down/browser navigated away)',
            1002: 'Protocol Error (endpoint received data that couldn\'t be processed)',
            1003: 'Unsupported Data (endpoint received unsupported data type)',
            1005: 'No Status Received (no status code in close frame)',
            1006: 'Abnormal Closure (connection terminated without proper close frame)',
            1007: 'Invalid Frame Payload Data (message contained inconsistent data)',
            1008: 'Policy Violation (received message violates policy)',
            1009: 'Message Too Big (message too large to process)',
            1010: 'Mandatory Extension (server didn\'t negotiate required extension)',
            1011: 'Internal Error (server encountered unexpected condition)',
            1012: 'Service Restart (server restarting)',
            1013: 'Try Again Later (server temporarily unavailable)',
            1014: 'Bad Gateway (gateway/proxy received invalid response)',
            1015: 'TLS Handshake (connection terminated during TLS handshake)'
          };

          const reason = closeCodes[event.code as keyof typeof closeCodes] || 'Unknown';
          console.log(`WebSocket connection closed: Code ${event.code} (${reason})`);
          if (event.reason) console.log(`Server close reason: ${event.reason}`);

          // Reset connection state
          setSocket(null);
          setConnected(false);
          socketRef.current = null;

          // Enhanced reconnection with more intelligent backoff
          if (autoReconnect && reconnectAttempts.current < maxReconnectAttempts) {
            // More sophisticated backoff algorithm
            // - Starts with shorter delays for first few attempts
            // - Increases more aggressively after several failures
            // - Adds jitter to prevent thundering herd
            let delay; 

            if (reconnectAttempts.current < 3) {
              // Quick retry for first few attempts
              delay = 1000 * (reconnectAttempts.current + 1) + Math.random() * 1000;
            } else {
              // Exponential backoff for persistent failures
              delay = Math.min(
                30000, // Cap at 30 seconds
                baseReconnectDelay * Math.pow(2, reconnectAttempts.current - 3) + 
                Math.floor(Math.random() * 3000) // More jitter for longer waits
              );
            }

            // Special handling for specific close codes
            if (event.code === 1013) { // Try Again Later
              console.log('Server is temporarily unavailable, using longer delay before reconnect');
              delay = Math.max(delay, 5000); // At least 5 seconds
            } else if (event.code === 1008 || event.code === 1011) { // Policy Violation or Internal Error
              console.log('Server reported policy violation or internal error, using longer delay');
              delay = Math.max(delay, 10000); // At least 10 seconds
            }

            console.log(`Reconnection scheduled in ${Math.round(delay)}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`);

            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectAttempts.current++;
              console.log(`Executing reconnection attempt ${reconnectAttempts.current}/${maxReconnectAttempts}`);
              connectWebSocket();
            }, delay);
          } else if (reconnectAttempts.current >= maxReconnectAttempts) {
            console.error(`Maximum reconnect attempts (${maxReconnectAttempts}) reached. WebSocket connection has failed.`);
            console.info('To manually retry connection, call the reconnect() function or refresh the page.');

            // Notify via callback if provided
            if (onMessage) {
              onMessage({
                type: 'connection_failed',
                message: 'WebSocket connection failed after multiple attempts',
                timestamp: Date.now()
              });
            }
          }
        });

        ws.addEventListener('error', (error) => {
          console.error('WebSocket error event:', error);
          connectionFailed = true;

          // Collect enhanced diagnostics about the current environment
          const readyStateMap = {
            0: 'CONNECTING',
            1: 'OPEN',
            2: 'CLOSING',
            3: 'CLOSED'
          };

          const diagnostics = {
            url: wsUrl,
            browser: navigator.userAgent,
            readyState: ws.readyState,
            readyStateText: readyStateMap[ws.readyState as keyof typeof readyStateMap] || 'UNKNOWN',
            reconnectAttempts: reconnectAttempts.current,
            timestamp: new Date().toISOString(),
            location: window.location.href,
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            isReplitEnv: window.location.hostname.includes('replit') || window.location.hostname.includes('repl.co')
          };

          console.log('Connection diagnostics:', diagnostics);

          // For Replit environments, provide specific guidance and apply special workarounds
          if (window.location.hostname.includes('replit') || window.location.hostname.includes('repl.co')) {
            console.log('Replit-specific environment detected:');
            console.log('- Try refreshing the page if WebSocket connection fails repeatedly');
            console.log('- WebSocket connections may be restricted by Replit security measures');
            console.log('- The application will automatically fall back to HTTP polling when WebSockets fail');

            // Signal to the application that WebSockets may be unavailable in Replit environment
            localStorage.setItem('websocket_blocked', 'true');

            // Special workaround for Replit's security restrictions
            // We'll immediately try to switch to HTTP polling to avoid waiting for multiple retries
            setTimeout(() => {
              if ((!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) && onError) {
                console.log('Proactively enabling HTTP fallback for Replit environment');
                onError({
                  type: 'replit_environment_detected',
                  message: 'Using HTTP polling fallback for Replit environment',
                  timestamp: Date.now(),
                  fallbackMechanism: 'http'
                });
              }
            }, 5000); // Give it 5 seconds to try connecting before forcing fallback
          }

          // Call user-provided error callback if available
          if (onError) {
            const errorInfo: WebSocketError = {
              type: 'connection_error',
              message: 'WebSocket connection error',
              originalError: error,
              diagnostics,
              timestamp: Date.now(),
              fallbackMechanism
            };
            onError(errorInfo);
          }

          localStorage.setItem('last_websocket_failure', new Date().toISOString());

          // If this is the first attempt, try reconnecting quickly
          if (reconnectAttempts.current === 0) {
            console.log('First WebSocket attempt failed, trying again quickly...');
            // Signal to use the fallback mechanism if the quick retry fails
            localStorage.setItem('use_fallback_mechanism', 'pending');
          }

          // Track persistent failures to enable HTTP fallback mechanism
          if (reconnectAttempts.current >= 2) {
            console.log('Multiple WebSocket failures detected, enabling HTTP fallback mechanism');
            localStorage.setItem('use_fallback_mechanism', 'true');

            // Trigger the onError callback if provided
            if (options.onError) {
              options.onError({
                type: 'websocket_persistent_failure',
                message: 'WebSocket connection failed after multiple attempts',
                reconnectAttempts: reconnectAttempts.current
              });
            }
          }

          // We still don't handle reconnection here directly as the 'close' event will trigger after an error
          // and has comprehensive reconnection logic
        });
      } catch (wsCreationError) {
        console.timeEnd('WebSocket Connection Attempt');
        console.error('Exception during WebSocket object creation:', wsCreationError);
        connectionFailed = true;

        // Immediate retry for WebSocket creation errors with a short delay
        console.log('WebSocket creation failed, scheduling retry with short delay');
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttempts.current++;
          connectWebSocket();
        }, 2000);
      }
    } catch (outerError) {
      // This catch block handles errors in the URL generation or other setup steps
      console.error('Critical error in WebSocket connection setup:', outerError);

      // If we can't even create the WebSocket, try again after a moderate delay
      console.log('Scheduling reconnection due to fatal setup error');
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectAttempts.current++;
        connectWebSocket();
      }, 5000);
    }
  }, [getWebSocketUrl, isAuthenticated, user, includeAuthToken, send, onMessage, autoReconnect]);

  useEffect(() => {
    // Only connect if path is provided
    if (path) {
      connectWebSocket();
    }

    // Cleanup function
    return () => {
      if (socketRef.current && (
        socketRef.current.readyState === WebSocket.OPEN || 
        socketRef.current.readyState === WebSocket.CONNECTING
      )) {
        socketRef.current.close();
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
    };
  }, [path, connectWebSocket]);

  return { socket, send, connected, reconnect };
};