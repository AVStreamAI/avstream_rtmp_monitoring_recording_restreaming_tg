# RTMP Monitoring & Recording & Restreaming & Telegram Notification

### Updates
21.11.2024 - RTMPS support has been added for forwarding RTMP streams.

## Description

This project operates on localhost and accepts incoming RTMP feeds. It offers the following features:  
- Automatically records incoming streams in the `/server/record/` folder.  
- Logs all events with timestamps in the same folder as the recordings.  
- Restreams the feed to up to four destinations without converting the incoming video.  
- Sends Telegram notifications for events like stream start, stop, or errors.  

### Setup  
- Insert your Telegram Bot token into the `.env` file.  

### How to Run  
1. Run the `start-rtmp-monitor.bat` file.  
2. It will automatically install all dependencies and start the service at [http://localhost:5173](http://localhost:5173).  

## License and Attribution
This project uses FFmpeg, which is licensed under the LGPL (Lesser General Public License). Please review the license details at https://ffmpeg.org/legal.html for more information.

## Author
The author of this code is Sergey Korneyev. For more information, visit https://avstream.ru or you can PM me at telegram https://t.me/Kvanterbreher
