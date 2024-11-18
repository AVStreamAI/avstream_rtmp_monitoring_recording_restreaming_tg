import NodeMediaServer from 'node-media-server';
import { WebSocketServer } from 'ws';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from './config.js';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import telegramBot from './telegram.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ffmpeg.setFfmpegPath(ffmpegStatic);

const mediaDir = path.resolve(__dirname, 'media');
const recordingPath = path.resolve(__dirname, 'recordings');
const hlsDir = path.resolve(mediaDir, 'live');

[mediaDir, recordingPath, hlsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const nms = new NodeMediaServer(config);
const app = express();
const wss = new WebSocketServer({ port: 8080 });

const cpuCount = os.cpus().length;
const optimalThreads = Math.max(2, Math.floor(cpuCount / 2));

app.use(cors());
app.use(express.json());
app.use('/live', express.static(String(mediaDir)));

const activeStreams = new Map();
const streamMetrics = new Map();
const forwardProcesses = new Map();

function broadcastMetrics(streamPath, metrics) {
  const streamKey = streamPath.split('/')[2];
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        ...metrics,
        streamKey,
        isActive: true
      }));
    }
  });
}

function broadcastStreamEnd(streamKey) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({
        streamKey,
        isActive: false,
        videoBitrate: 0,
        audioBitrate: 0,
        frameRate: 0,
        resolution: '',
        videoCodec: '',
        audioCodec: '',
        duration: 0,
        timestamp: Date.now()
      }));
    }
  });
}

nms.on('prePublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath}`);
  const streamKey = StreamPath.split('/')[2];
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const recordingFile = path.resolve(recordingPath, `${streamKey}_${timestamp}.ts`);
  const metricsFile = path.resolve(recordingPath, `${streamKey}_${timestamp}_metrics.json`);
  
  try {
    ffmpeg.ffprobe(`rtmp://127.0.0.1:1935${StreamPath}`, async (err, metadata) => {
      if (!err && metadata) {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        
        const streamInfo = {
          resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'N/A',
          videoCodec: videoStream?.codec_name || 'N/A',
          audioCodec: audioStream?.codec_name || 'N/A',
          videoBitrate: parseInt(videoStream?.bit_rate) || 0,
          audioBitrate: parseInt(audioStream?.bit_rate) || 0,
          totalBitrate: parseInt(metadata.format.bit_rate) || 0
        };

        await telegramBot.streamStarted(streamKey, streamInfo);
      }
    });

    const stream = ffmpeg()
      .input(`rtmp://127.0.0.1:1935${StreamPath}`)
      .outputOptions([
        '-c copy',
        '-f mpegts',
        '-muxdelay 0'
      ])
      .output(recordingFile);

    stream.on('end', () => {
      console.log('Recording finished:', recordingFile);
    });

    stream.on('error', (err) => {
      console.error('Recording error:', err);
    });

    stream.run();
    activeStreams.set(StreamPath, { 
      recordingFile,
      metricsFile,
      startTime: Date.now(),
      id,
      forwardProcesses: new Map(),
      metricsLog: []
    });
    
    startMetricsCollection(StreamPath);
  } catch (error) {
    console.error('Failed to start recording:', error);
  }
});

nms.on('donePublish', async (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath}`);
  const streamData = activeStreams.get(StreamPath);
  if (streamData) {
    const streamKey = StreamPath.split('/')[2];
    const duration = (Date.now() - streamData.startTime) / 1000;
    
    // Save metrics to file
    if (streamData.metricsLog && streamData.metricsLog.length > 0) {
      try {
        fs.writeFileSync(streamData.metricsFile, JSON.stringify(streamData.metricsLog, null, 2));
        console.log('Metrics saved to:', streamData.metricsFile);
      } catch (error) {
        console.error('Error saving metrics:', error);
      }
    }
    
    // Stop all forwarding processes
    for (const [destinationId, process] of streamData.forwardProcesses.entries()) {
      process.kill();
      await telegramBot.forwardingEnded(destinationId, process.destinationUrl, process.destinationKey);
    }
    
    streamData.forwardProcesses.clear();
    const finalMetrics = streamMetrics.get(StreamPath);
    activeStreams.delete(StreamPath);
    streamMetrics.delete(StreamPath);
    
    broadcastStreamEnd(streamKey);
    await telegramBot.streamEnded(streamKey, duration, finalMetrics);
  }
});

function startMetricsCollection(streamPath) {
  const streamData = activeStreams.get(streamPath);
  if (!streamData) return;

  const metricsInterval = setInterval(() => {
    if (!activeStreams.has(streamPath)) {
      clearInterval(metricsInterval);
      return;
    }

    ffmpeg.ffprobe(`rtmp://127.0.0.1:1935${streamPath}`, async (err, metadata) => {
      if (err) {
        console.error('FFprobe error:', err);
        return;
      }
      
      try {
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        const streamDuration = (Date.now() - streamData.startTime) / 1000;
        
        const metrics = {
          timestamp: Date.now(),
          streamKey: streamPath.split('/')[2],
          videoCodec: videoStream?.codec_name || 'N/A',
          audioCodec: audioStream?.codec_name || 'N/A',
          resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : 'N/A',
          frameRate: parseFloat(videoStream?.r_frame_rate.split('/')[0]) || 0,
          videoBitrate: parseInt(videoStream?.bit_rate) || 0,
          audioBitrate: parseInt(audioStream?.bit_rate) || 0,
          duration: streamDuration,
          totalBitrate: parseInt(metadata.format.bit_rate) || 0
        };

        if (metrics.videoBitrate > 0 && metrics.videoBitrate < 2000000) {
          await telegramBot.lowBitrateAlert(metrics.streamKey, metrics.videoBitrate);
        }

        streamData.metricsLog.push(metrics);
        streamMetrics.set(streamPath, metrics);
        broadcastMetrics(streamPath, metrics);
      } catch (error) {
        console.error('Error processing metrics:', error);
      }
    });
  }, 2000);
}

app.post('/api/forward', async (req, res) => {
  const { action, sourceKey, destinationUrl, destinationKey, destinationId } = req.body;
  const streamPath = `/live/${sourceKey}`;
  const streamData = activeStreams.get(streamPath);

  if (!streamData) {
    res.status(404).json({ error: 'Stream not found' });
    return;
  }

  if (action === 'start') {
    if (streamData.forwardProcesses.has(destinationId)) {
      res.status(400).json({ error: 'Stream is already being forwarded to this destination' });
      return;
    }

    try {
      const process = ffmpeg()
        .input(`rtmp://127.0.0.1:1935${streamPath}`)
        .inputOptions([
          '-re',
          '-fflags nobuffer',
          '-flags low_delay'
        ])
        .outputOptions([
          '-c copy',
          '-f flv',
          '-flvflags no_duration_filesize',
          '-threads', optimalThreads.toString()
        ])
        .output(`${destinationUrl}/${destinationKey}`);

      // Store destination info for telegram notifications
      process.destinationUrl = destinationUrl;
      process.destinationKey = destinationKey;

      process.on('start', async () => {
        console.log(`Started forwarding to destination ${destinationId}`);
        await telegramBot.forwardingStarted(destinationId, destinationUrl, destinationKey);
      });

      process.on('end', async () => {
        console.log(`Forwarding ended for destination ${destinationId}`);
        streamData.forwardProcesses.delete(destinationId);
        await telegramBot.forwardingEnded(destinationId, destinationUrl, destinationKey);
      });

      process.on('error', async (err) => {
        console.error(`Forwarding error for destination ${destinationId}:`, err);
        streamData.forwardProcesses.delete(destinationId);
        await telegramBot.forwardingError(destinationId, destinationUrl, destinationKey, err.message);
      });

      process.run();
      streamData.forwardProcesses.set(destinationId, process);
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to start forwarding:', error);
      res.status(500).json({ error: 'Failed to start forwarding' });
    }
  } else if (action === 'stop') {
    const process = streamData.forwardProcesses.get(destinationId);
    if (process) {
      process.kill();
      streamData.forwardProcesses.delete(destinationId);
      await telegramBot.forwardingStopped(destinationId, process.destinationUrl, process.destinationKey);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Forwarding process not found' });
    }
  } else {
    res.status(400).json({ error: 'Invalid action' });
  }
});

app.get('/api/recordings', (req, res) => {
  fs.readdir(recordingPath, (err, files) => {
    if (err) {
      res.status(500).json({ error: 'Failed to read recordings directory' });
      return;
    }
    res.json(files);
  });
});

app.get('/api/metrics', (req, res) => {
  const allMetrics = Array.from(streamMetrics.entries()).map(([path, metrics]) => ({
    streamPath: path,
    ...metrics
  }));
  res.json(allMetrics);
});

app.get('/api/recordings/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.resolve(recordingPath, filename);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'Recording not found' });
  }
});

nms.run();
app.listen(3000, () => console.log('Express server running on port 3000'));