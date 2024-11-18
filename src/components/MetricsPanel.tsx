import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

interface MetricsPanelProps {
  metrics: {
    videoBitrate: number[];
    audioBitrate: number[];
    frameRate: number[];
    resolution: string;
    videoCodec: string;
    audioCodec: string;
    duration: number;
    timestamp: number[];
    isActive?: boolean;
  };
  onDownloadLogs: () => void;
}

const formatBitrate = (bitrate: number) => {
  return `${(bitrate / 1000000).toFixed(2)} Mbps`;
};

const formatDuration = (seconds: number, frameRate: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds * frameRate) % frameRate);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

export function MetricsPanel({ metrics, onDownloadLogs }: MetricsPanelProps) {
  const currentFrameRate = metrics.isActive ? (metrics.frameRate[metrics.frameRate.length - 1] || 0) : 0;
  const currentVideoBitrate = metrics.isActive ? (metrics.videoBitrate[metrics.videoBitrate.length - 1] || 0) : 0;
  const currentAudioBitrate = metrics.isActive ? (metrics.audioBitrate[metrics.audioBitrate.length - 1] || 0) : 0;
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    // Reset timer when stream stops
    if (!metrics.isActive) {
      setCurrentTime(0);
      return;
    }

    // Update the base time when metrics.duration changes and stream is active
    setCurrentTime(metrics.duration);
  }, [metrics.duration, metrics.isActive]);

  useEffect(() => {
    if (!metrics.isActive) return;

    // Update time every frame only when stream is active
    const frameInterval = currentFrameRate > 0 ? 1000 / currentFrameRate : 1000 / 30; // fallback to 30fps
    const timer = setInterval(() => {
      setCurrentTime(prev => prev + frameInterval / 1000);
    }, frameInterval);

    return () => clearInterval(timer);
  }, [currentFrameRate, metrics.isActive]);

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Video Bitrate Display */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-col items-center justify-center h-24">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Video Bitrate</h3>
          <p className="text-3xl font-bold text-sky-400">{formatBitrate(currentVideoBitrate)}</p>
        </div>
      </div>

      {/* Audio Bitrate Display */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-col items-center justify-center h-24">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Audio Bitrate</h3>
          <p className="text-3xl font-bold text-pink-400">{formatBitrate(currentAudioBitrate)}</p>
        </div>
      </div>

      {/* Frame Rate Display */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-col items-center justify-center h-24">
          <h3 className="text-gray-400 text-sm font-medium mb-2">Frame Rate</h3>
          <div className="flex items-baseline gap-2">
            <p className="text-3xl font-bold text-purple-400">{currentFrameRate.toFixed(1)}</p>
            <span className="text-gray-400 text-sm">FPS</span>
          </div>
        </div>
      </div>

      {/* Stream Information */}
      <div className="bg-gray-800 rounded-lg p-4 col-span-2">
        <h2 className="text-xl font-bold mb-4">Stream Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Video Codec" value={metrics.isActive ? metrics.videoCodec : ''} />
          <InfoItem label="Audio Codec" value={metrics.isActive ? metrics.audioCodec : ''} />
          <InfoItem label="Resolution" value={metrics.isActive ? metrics.resolution : ''} />
          <InfoItem 
            label="Duration" 
            value={formatDuration(currentTime, currentFrameRate)}
            className="font-mono"
          />
        </div>
      </div>

      {/* Download Logs Button */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h2 className="text-xl font-bold mb-4">Stream Logs</h2>
        <button
          onClick={onDownloadLogs}
          className="w-full bg-green-600 hover:bg-green-700 rounded-md px-4 py-2 flex items-center justify-center gap-2 transition-colors"
        >
          <Download className="w-5 h-5" /> Download Logs
        </button>
         <p className="mt-2 text-sm text-gray-400">
        Logs and recordings of the incoming RTMP stream are automatically saved and stored in the project's /server/recordings/ folder.
        </p>
        <p className="mt-2 text-sm text-blue-400">
        The service was developed by Sergey Korneyev for the AVStream community.
        </p>
      </div>
    </div>
  );
}

function InfoItem({ label, value, className = '' }: { label: string; value: string | number; className?: string }) {
  return (
    <div className="bg-gray-700 p-3 rounded-lg">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className={`font-medium mt-1 ${className}`}>{value || 'N/A'}</div>
    </div>
  );
}