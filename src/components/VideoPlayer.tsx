import React, { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  streamKey: string;
}

export function VideoPlayer({ streamKey }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Clear previous error
    setError(null);

    // Cleanup previous player
    if (playerRef.current) {
      playerRef.current.destroy();
      playerRef.current = null;
    }

    if (!streamKey || !videoRef.current) {
      return;
    }

    // Wait for flv.js to be loaded
    const initPlayer = () => {
      if (!window.flvjs) {
        setTimeout(initPlayer, 100);
        return;
      }

      if (!window.flvjs.isSupported()) {
        setError("FLV playback is not supported in this browser");
        return;
      }

      try {
        const videoElement = videoRef.current;
        if (!videoElement) return;

        playerRef.current = window.flvjs.createPlayer({
          type: 'flv',
          url: `http://localhost:8000/live/${streamKey}.flv`,
          isLive: true,
          hasAudio: true,
          hasVideo: true,
          enableStashBuffer: false,
          stashInitialSize: 128,
          enableWorker: true,
          autoCleanupSourceBuffer: true
        });

        playerRef.current.attachMediaElement(videoElement);
        playerRef.current.load();
        
        const playPromise = videoElement.play();
        if (playPromise) {
          playPromise.catch(error => {
            console.error('Error playing video:', error);
            setError("Failed to play the stream. Click to unmute.");
          });
        }
      } catch (err) {
        console.error('Error initializing player:', err);
        setError("Failed to initialize video player");
      }
    };

    initPlayer();

    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [streamKey]);

  const handleVideoClick = () => {
    if (videoRef.current) {
      videoRef.current.muted = false;
      setError(null);
    }
  };

  return (
    <div className="aspect-video bg-black rounded-lg flex items-center justify-center relative">
      {streamKey ? (
        <>
          <video
            ref={videoRef}
            className="w-full h-full rounded-lg"
            controls
            playsInline
            muted
            onClick={handleVideoClick}
          />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 cursor-pointer" onClick={handleVideoClick}>
              <p className="text-red-500">{error}</p>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500">Waiting for incoming stream...</p>
      )}
    </div>
  );
}