/// <reference types="vite/client" />

interface Window {
  flvjs: {
    createPlayer: (config: {
      type: string;
      url: string;
    }) => {
      attachMediaElement: (element: HTMLVideoElement) => void;
      load: () => void;
      play: () => Promise<void>;
      destroy: () => void;
    };
    isSupported: () => boolean;
  };
}