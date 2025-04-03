import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

// WebSocketTest component for debugging WebSocket issues
export default function WebSocketTest() {
  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [messages, setMessages] = useState<{ type: 'sent' | 'received' | 'system'; content: string; timestamp: Date }[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [connectionUrl, setConnectionUrl] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  
  // Function to safely add a WebSocket message to the list
  const addMessage = (type: 'sent' | 'received' | 'system', content: string) => {
    setMessages(prev => [...prev, { type, content, timestamp: new Date() }]);
  };
  
  // Function to connect to the WebSocket
  const connectWebSocket = () => {
    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    
    try {
      setWsStatus('connecting');
      
      // Generate the WebSocket URL
      let wsUrl: string;
      if (connectionUrl) {
        // Use provided URL
        wsUrl = connectionUrl;
      } else {
        // Use default URL with timestamped cache buster
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const timestamp = Date.now();
        wsUrl = `${protocol}//${host}/ws?_=${timestamp}`;
      }
      
      // Create new WebSocket connection
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      addMessage('system', `Connecting to ${wsUrl}...`);
      
      // Set up WebSocket event handlers
      ws.onopen = () => {
        setWsStatus('connected');
        addMessage('system', 'Connection established');
      };
      
      ws.onmessage = (event) => {
        addMessage('received', event.data);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsStatus('error');
        addMessage('system', `Error: ${error}`);
      };
      
      ws.onclose = (event) => {
        setWsStatus('disconnected');
        addMessage('system', `Connection closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
      };
      
      // Set up ping interval
      const pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const pingMsg = JSON.stringify({ type: 'ping', timestamp: Date.now() });
          ws.send(pingMsg);
          addMessage('sent', pingMsg);
        }
      }, 30000); // 30 second ping
      
      // Clean up on unmount
      return () => {
        clearInterval(pingInterval);
        if (ws) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setWsStatus('error');
      addMessage('system', `Setup error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Function to send a message through WebSocket
  const sendMessage = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && inputMessage) {
      wsRef.current.send(inputMessage);
      addMessage('sent', inputMessage);
      setInputMessage('');
    } else {
      addMessage('system', 'Cannot send message: WebSocket not connected');
    }
  };
  
  // Function to disconnect WebSocket
  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setWsStatus('disconnected');
      addMessage('system', 'Disconnected by user');
    }
  };
  
  // Auto-scroll to bottom when messages change
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Render status indicator
  const renderStatusIndicator = () => {
    let color = '';
    let text = '';
    
    switch (wsStatus) {
      case 'connected':
        color = 'bg-green-500';
        text = 'Connected';
        break;
      case 'connecting':
        color = 'bg-yellow-500';
        text = 'Connecting';
        break;
      case 'disconnected':
        color = 'bg-gray-500';
        text = 'Disconnected';
        break;
      case 'error':
        color = 'bg-red-500';
        text = 'Error';
        break;
    }
    
    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${color}`}></div>
        <span>{text}</span>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto py-8">
      <Card className="w-full">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>WebSocket Test Client</CardTitle>
              <CardDescription>Use this tool to debug WebSocket connections</CardDescription>
            </div>
            <div>
              {renderStatusIndicator()}
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="mb-4">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="WebSocket URL (leave empty for default)"
                value={connectionUrl}
                onChange={(e) => setConnectionUrl(e.target.value)}
                className="flex-1"
              />
              <Button
                onClick={connectWebSocket}
                disabled={wsStatus === 'connecting'}
                variant="default"
              >
                Connect
              </Button>
              <Button
                onClick={disconnectWebSocket}
                disabled={wsStatus === 'disconnected'}
                variant="destructive"
              >
                Disconnect
              </Button>
            </div>
            
            <Alert variant="outline" className="mb-4">
              <AlertTitle>Connection Info</AlertTitle>
              <AlertDescription>
                <div className="text-sm">
                  {wsStatus === 'disconnected' && (
                    <p>Click Connect to establish a WebSocket connection. Leave the URL field empty to use the default connection.</p>
                  )}
                  {wsStatus === 'connecting' && (
                    <p>Attempting to establish WebSocket connection...</p>
                  )}
                  {wsStatus === 'connected' && wsRef.current && (
                    <p>Connected to: {wsRef.current.url}</p>
                  )}
                  {wsStatus === 'error' && (
                    <p className="text-red-500">Connection error. Check console for details.</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="border rounded-md p-4 mb-4">
              <h3 className="font-medium mb-2">Messages:</h3>
              <ScrollArea className="h-64 w-full rounded border p-4">
                {messages.map((msg, index) => (
                  <div key={index} className="mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        msg.type === 'sent' ? 'default' :
                        msg.type === 'received' ? 'secondary' : 'destructive'
                      }>
                        {msg.type.charAt(0).toUpperCase() + msg.type.slice(1)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {msg.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm mt-1 p-2 rounded bg-muted">
                      {msg.content}
                    </pre>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </ScrollArea>
            </div>
            
            <div className="flex gap-2">
              <Textarea
                placeholder="Enter message to send..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={wsStatus !== 'connected' || !inputMessage}
              >
                Send
              </Button>
            </div>
          </div>
        </CardContent>
        
        <CardFooter>
          <div className="text-sm text-gray-500">
            Quick commands:
            <div className="flex gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputMessage(JSON.stringify({ type: 'ping' }))}
              >
                Ping
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputMessage(JSON.stringify({ type: 'auth', userId: 1 }))}
              >
                Auth
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInputMessage(JSON.stringify({ type: 'subscribe', symbols: ['AAPL', 'MSFT'] }))}
              >
                Subscribe
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}