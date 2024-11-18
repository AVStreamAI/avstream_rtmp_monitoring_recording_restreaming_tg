import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const mediaRoot = path.resolve(__dirname, 'media');
const cpuCount = os.cpus().length;

export const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    mediaroot: mediaRoot,
    allow_origin: '*'
  },
  auth: {
    play: false,
    publish: false,
    secret: 'nodemedia2017privatekey'
  },
  trans: {
    ffmpeg: ffmpegStatic,
    tasks: [
      {
        app: 'live',
        flv: true,
        flvFlags: '[flvflags=no_duration_filesize]',
        threads: Math.max(2, Math.floor(cpuCount / 2))
      }
    ]
  },
  relay: {
    ffmpeg: ffmpegStatic,
    tasks: []
  },
  logType: 3
};