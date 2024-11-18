import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, Plus, Minus, Play, Pause } from 'lucide-react';
import { VideoPlayer } from './components/VideoPlayer';
import { MetricsPanel } from './components/MetricsPanel';

interface Destination {
  url: string;
  key: string;
  isActive: boolean;
  isForwarding: boolean;
}

interface StreamMetrics {
  videoBitrate: number[];
  audioBitrate: number[];
  frameRate: number[];
  resolution: string;
  videoCodec: string;
  audioCodec: string;
  duration: number;
  timestamp: number[];
  isActive: boolean;
}

function App() {
  const [destinations, setDestinations] = useState<Destination[]>([
    { url: '', key: '', isActive: false, isForwarding: false }
  ]);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeStreamKey, setActiveStreamKey] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const [metrics, setMetrics] = useState<StreamMetrics>({
    videoBitrate: [],
    audioBitrate: [],
    frameRate: [],
    resolution: '',
    videoCodec: '',
    audioCodec: '',
    duration: 0,
    timestamp: [],
    isActive: false
  });

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.streamKey && !activeStreamKey) {
          setActiveStreamKey(data.streamKey);
        }

        setMetrics(prev => ({
          ...prev,
          videoBitrate: data.isActive ? [...prev.videoBitrate, data.videoBitrate].slice(-30) : [],
          audioBitrate: data.isActive ? [...prev.audioBitrate, data.audioBitrate].slice(-30) : [],
          frameRate: data.isActive ? [...prev.frameRate, data.frameRate].slice(-30) : [],
          timestamp: data.isActive ? [...prev.timestamp, data.timestamp].slice(-30) : [],
          resolution: data.resolution || '',
          videoCodec: data.videoCodec || '',
          audioCodec: data.audioCodec || '',
          duration: data.duration || 0,
          isActive: data.isActive
        }));

        if (!data.isActive) {
          setActiveStreamKey(null);
          setDestinations(prev => prev.map(dest => ({
            ...dest,
            isActive: false,
            isForwarding: false
          })));
        }
      } catch (error) {
        console.error('Error parsing metrics:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
      wsRef.current = null;
      
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, [activeStreamKey]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectWebSocket]);

  const handleForwardingToggle = async (index: number) => {
    if (!activeStreamKey) return;
  
    try {
      const destination = destinations[index];
      const action = destination.isForwarding ? 'stop' : 'start';
  
      // Optimistically update UI state
      setDestinations(prev => prev.map((dest, i) => 
        i === index ? { ...dest, isForwarding: !dest.isForwarding } : dest
      ));
  
      const response = await fetch(`http://localhost:3000/api/forward`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          sourceKey: activeStreamKey,
          destinationUrl: destination.url,
          destinationKey: destination.key,
          destinationId: index
        }),
      });
  
      if (!response.ok) {
        // Revert UI state if request failed
        setDestinations(prev => prev.map((dest, i) => 
          i === index ? { ...dest, isForwarding: !dest.isForwarding } : dest
        ));
        const error = await response.json();
        console.error('Failed to toggle forwarding:', error);
      }
    } catch (error) {
      // Revert UI state on error
      setDestinations(prev => prev.map((dest, i) => 
        i === index ? { ...dest, isForwarding: !dest.isForwarding } : dest
      ));
      console.error('Error toggling forwarding:', error);
    }
  };

  const addDestination = () => {
    if (destinations.length < 4) {
      setDestinations([...destinations, { url: '', key: '', isActive: false, isForwarding: false }]);
    }
  };

  const removeDestination = (index: number) => {
    if (destinations[index].isForwarding) {
      handleForwardingToggle(index);
    }
    setDestinations(destinations.filter((_, i) => i !== index));
  };

  const updateDestination = (index: number, field: 'url' | 'key', value: string) => {
    setDestinations(destinations.map((dest, i) => 
      i === index ? { ...dest, [field]: value } : dest
    ));
  };

  const downloadLogs = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/metrics');
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stream-metrics.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download logs:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Video Player Section */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-xl font-bold mb-4">AVStream RTMP Monitoring & Record Dashboard</h2>
          <VideoPlayer streamKey={activeStreamKey || ''} />
          <div className="mt-2 text-sm text-gray-400">
            Incoming RTMP: rtmp://127.0.0.1:1935/live/{activeStreamKey || '[waiting for stream]'}
          </div>
        </div>

        {/* Stream Control Section */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Forward Stream</h2>
            {destinations.length < 4 && (
              <button
                onClick={addDestination}
                className="bg-green-600 hover:bg-green-700 rounded-full p-2 transition-colors"
                title="Add destination"
              >
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="space-y-6">
            {destinations.map((destination, index) => (
              <div key={index} className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">Destination {index + 1}</h3>
                  {destinations.length > 1 && (
                    <button
                      onClick={() => removeDestination(index)}
                      className="text-red-500 hover:text-red-400 p-1"
                      title="Remove destination"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">RTMP URL</label>
                    <input
                      type="text"
                      value={destination.url}
                      onChange={(e) => updateDestination(index, 'url', e.target.value)}
                      className="w-full bg-gray-600 rounded-md px-4 py-2"
                      placeholder="e.g., rtmp://a.rtmp.youtube.com/live2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Stream Key</label>
                    <input
                      type="text"
                      value={destination.key}
                      onChange={(e) => updateDestination(index, 'key', e.target.value)}
                      className="w-full bg-gray-600 rounded-md px-4 py-2"
                      placeholder="Your stream key"
                    />
                  </div>
                  <button
                    onClick={() => handleForwardingToggle(index)}
                    disabled={!activeStreamKey || !destination.url || !destination.key}
                    className={`w-full rounded-md px-4 py-2 flex items-center justify-center gap-2 transition-colors ${
                      activeStreamKey && destination.url && destination.key
                        ? destination.isForwarding
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-gray-600 cursor-not-allowed'
                    }`}
                  >
                    {destination.isForwarding ? (
                      <>
                        <Pause className="w-5 h-5" /> Stop Forwarding
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" /> Start Forwarding
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-4 text-sm ${wsConnected ? 'text-green-500' : 'text-red-500'}`}>
            {wsConnected ? 'Application running' : 'Application stopped'}
          </div>
        </div>
      </div>

      <MetricsPanel 
        metrics={metrics}
        onDownloadLogs={downloadLogs}
      />
    </div>
  );
}

export default App;