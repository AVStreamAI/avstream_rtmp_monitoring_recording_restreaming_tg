import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAT_IDS_FILE = path.join(__dirname, 'chatids.json');
const BITRATE_THRESHOLD = 2000000; // 2 Mbit/s

class TelegramNotifier {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    this.chatIds = new Set();
    this.loadChatIds();
    this.setupCommands();
  }

  loadChatIds() {
    try {
      if (fs.existsSync(CHAT_IDS_FILE)) {
        const ids = JSON.parse(fs.readFileSync(CHAT_IDS_FILE, 'utf8'));
        this.chatIds = new Set(ids);
      }
    } catch (error) {
      console.error('Error loading chat IDs:', error);
    }
  }

  saveChatIds() {
    try {
      fs.writeFileSync(CHAT_IDS_FILE, JSON.stringify([...this.chatIds]));
    } catch (error) {
      console.error('Error saving chat IDs:', error);
    }
  }

  setupCommands() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.chatIds.add(chatId);
      this.saveChatIds();
      this.bot.sendMessage(chatId, 'Welcome! You will now receive RTMP stream notifications.');
    });
  }

  async sendNotification(message) {
    for (const chatId of this.chatIds) {
      try {
        await this.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      } catch (error) {
        console.error(`Error sending message to chat ${chatId}:`, error);
        if (error.response?.statusCode === 403) {
          this.chatIds.delete(chatId);
          this.saveChatIds();
        }
      }
    }
  }

  formatBitrate(bitrate) {
    return bitrate ? `${(bitrate / 1000000).toFixed(2)} Mbps` : 'N/A';
  }

  async streamStarted(streamKey, streamInfo) {
    await this.sendNotification(
      `🎥 <b>Stream Started</b>\n\n` +
      `Stream key: <code>${streamKey}</code>\n\n` +
      `<b>Stream Information:</b>\n` +
      `• Resolution: <code>${streamInfo.resolution}</code>\n` +
      `• Video Codec: <code>${streamInfo.videoCodec}</code>\n` +
      `• Audio Codec: <code>${streamInfo.audioCodec}</code>\n` +
      `• Video Bitrate: <code>${this.formatBitrate(streamInfo.videoBitrate)}</code>\n` +
      `• Audio Bitrate: <code>${this.formatBitrate(streamInfo.audioBitrate)}</code>\n` +
      `• Total Bitrate: <code>${this.formatBitrate(streamInfo.totalBitrate)}</code>`
    );
  }

  async streamEnded(streamKey, duration, finalMetrics) {
    const formattedDuration = new Date(duration * 1000).toISOString().substr(11, 8);
    let message = `🛑 <b>Stream Ended</b>\n\n` +
                 `Stream key: <code>${streamKey}</code>\n` +
                 `Duration: ${formattedDuration}`;

    if (finalMetrics) {
      message += `\n\n<b>Final Stream Metrics:</b>\n` +
                `• Resolution: <code>${finalMetrics.resolution}</code>\n` +
                `• Video Codec: <code>${finalMetrics.videoCodec}</code>\n` +
                `• Audio Codec: <code>${finalMetrics.audioCodec}</code>\n` +
                `• Video Bitrate: <code>${this.formatBitrate(finalMetrics.videoBitrate)}</code>\n` +
                `• Audio Bitrate: <code>${this.formatBitrate(finalMetrics.audioBitrate)}</code>\n` +
                `• Total Bitrate: <code>${this.formatBitrate(finalMetrics.totalBitrate)}</code>`;
    }

    await this.sendNotification(message);
  }

  async lowBitrateAlert(streamKey, bitrate) {
    await this.sendNotification(
      `⚠️ <b>Low Bitrate Alert</b>\n\n` +
      `Stream key: <code>${streamKey}</code>\n` +
      `Current bitrate: <code>${this.formatBitrate(bitrate)}</code>\n` +
      `Threshold: <code>${this.formatBitrate(BITRATE_THRESHOLD)}</code>`
    );
  }

  async forwardingStarted(destinationId, destinationUrl, destinationKey) {
    await this.sendNotification(
      `▶️ <b>Forwarding Started</b>\n\n` +
      `<b>Destination:</b> ${destinationId + 1}\n` +
      `<b>RTMP URL:</b> <code>${destinationUrl}</code>\n` +
      `<b>RTMP Key:</b> <code>${destinationKey}</code>`
    );
  }

  async forwardingStopped(destinationId, destinationUrl, destinationKey) {
    await this.sendNotification(
      `⏹️ <b>Forwarding Stopped</b>\n\n` +
      `<b>Destination:</b> ${destinationId + 1}\n` +
      `<b>RTMP URL:</b> <code>${destinationUrl}</code>\n` +
      `<b>RTMP Key:</b> <code>${destinationKey}</code>`
    );
  }

  async forwardingEnded(destinationId, destinationUrl, destinationKey) {
    await this.sendNotification(
      `⏹️ <b>Forwarding Ended</b>\n\n` +
      `<b>Destination:</b> ${destinationId + 1}\n` +
      `<b>RTMP URL:</b> <code>${destinationUrl}</code>\n` +
      `<b>RTMP Key:</b> <code>${destinationKey}</code>`
    );
  }

  async forwardingError(destinationId, destinationUrl, destinationKey, error) {
    await this.sendNotification(
      `❌ <b>Forwarding Error</b>\n\n` +
      `<b>Destination:</b> ${destinationId + 1}\n` +
      `<b>RTMP URL:</b> <code>${destinationUrl}</code>\n` +
      `<b>RTMP Key:</b> <code>${destinationKey}</code>\n` +
      `<b>Error:</b> <code>${error}</code>`
    );
  }
}

const telegramNotifier = new TelegramNotifier();
export default telegramNotifier;