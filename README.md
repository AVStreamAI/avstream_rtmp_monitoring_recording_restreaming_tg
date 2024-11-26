# RTMP Monitoring & Recording & Restreaming & Telegram Notification

### Updates
26.11.2024 - Release v.0.4 - System Mertics and Video Bitrate history [Download](https://github.com/AVStreamAI/avstream_rtmp_monitoring_recording_restreaming_tg/releases/tag/release-0.4)

21.11.2024 - RTMPS support has been added for forwarding RTMP streams.

22.11.2024 - Access the service from any device on your local network.

## Description

This project operates on localhost and accepts incoming RTMP feeds. It offers the following features:  
- Automatically records incoming streams in the `/server/record/` folder.  
- Logs all events with timestamps in the same folder as the recordings.  
- Restreams the feed to up to four destinations without converting the incoming video.  
- Sends Telegram notifications for events like stream start, stop, or errors.  

### Setup  
- Insert your Telegram Bot token into the `.env` file.
- Some users first need to install Node.js and ffmpeg on their system. Don't forget to add ffmpeg to the PATH.
- Node.js: https://nodejs.org/
- FFmpeg for windows: https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-essentials.7z

Adding FFmpeg to the System PATH:

Windows:

- Open the Start Menu, search for "Environment Variables," and select "Edit the system environment variables."
- In the System Properties window, click on "Environment Variables."
- Under "System variables," find and select the "Path" variable, then click "Edit."
- Click "New" and add the path to the FFmpeg 'bin' directory (e.g., `C:/ffmpeg/bin`).
- Click "OK" to close all windows.

Small amount of users need to download https://www.npmjs.com/package/bluebird and place it into `/node_modules/bluebird/`

### How to Run  
1. Run the `start-rtmp-monitor.bat` file.  
2. It will automatically install all dependencies and start the service at [http://localhost:5173](http://localhost:5173).  

## License and Attribution
This project uses FFmpeg, which is licensed under the LGPL (Lesser General Public License). Please review the license details at https://ffmpeg.org/legal.html for more information.

## Author
The author of this code is Sergey Korneyev. For more information, visit https://avstream.ru or you can PM me at telegram https://t.me/Kvanterbreher
