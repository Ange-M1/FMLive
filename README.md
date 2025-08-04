# Live Stream Viewer - Real-time System

A complete live streaming solution with real-time viewer and download capabilities, similar to TikTok Live functionality.

## Features

### 🎥 Live Streaming
- **Real-time capture**: Record live video with 6-second segments
- **Auto-save**: Segments automatically saved to `LIVERESULTS` folder
- **Mirror effect**: Front camera mirroring for better user experience
- **Low latency**: 500ms segment checking for minimal delay

### 📺 Live Viewer
- **Real-time playback**: Watch live streams with minimal latency
- **Mirror effect**: Live overlay with pulsing indicator
- **Buffer monitoring**: Real-time buffer health and latency tracking
- **Segment queue**: Visual display of upcoming segments
- **Auto-reconnect**: Automatic recovery from connection issues

### 💾 Download Capability
- **Complete stream download**: Download entire live stream as single video
- **Progress tracking**: Real-time download progress with status updates
- **MP4 format**: Compatible video format for easy playback
- **Offline viewing**: Watch downloaded streams anytime

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
node server.js
```

### 3. Access the Applications
- **Live Streamer**: http://localhost:3000 (demoIndex.html)
- **Live Viewer**: http://localhost:3000/live (live.html)

## How to Use

### Starting a Live Stream

1. Open http://localhost:3000 in your browser
2. Click "Start Live" to begin recording
3. Allow camera and microphone permissions
4. The system will automatically:
   - Record 6-second video segments
   - Save segments to `LIVERESULTS` folder
   - Create manifest files for HLS streaming

### Watching Live Streams

1. Open http://localhost:3000/live in a separate browser window
2. Click "Connect to Stream" to start viewing
3. The viewer will:
   - Monitor `LIVERESULTS` folder for new segments
   - Play segments in real-time with minimal latency
   - Display live status and buffer health
   - Show segment queue for upcoming content

### Downloading Complete Streams

1. In the live viewer, click "Download Complete Stream"
2. The system will:
   - Combine all segments into a single MP4 file
   - Show download progress in real-time
   - Automatically trigger download when complete

## File Structure

```
├── demoIndex.html          # Live streamer interface
├── live.html              # Real-time viewer interface
├── liveStreamer.js        # Live streaming logic
├── server.js              # Express server with API endpoints
├── test-live.js           # Test script for simulation
├── LIVERESULTS/           # Auto-saved segments and manifests
│   ├── segment_000000.ts
│   ├── segment_000001.ts
│   ├── playlist.m3u8
│   └── ...
└── package.json
```

## API Endpoints

### GET `/api/segments`
Returns list of available segments in `LIVERESULTS` folder.

### GET `/api/segments/:filename`
Returns specific segment file.

### GET `/api/manifest`
Returns current HLS manifest file.

### GET `/api/status`
Returns live stream status (isLive, segments count, last segment).

## Testing

### Create Test Segments
```bash
node test-live.js
```

### Simulate Live Stream
```bash
node test-live.js --simulate 60  # 60-second simulation
```

## Technical Details

### Segment Format
- **Duration**: 6 seconds per segment
- **Format**: MPEG-TS (.ts files)
- **Codec**: H.264 video + AAC audio
- **Quality**: 720p at 30fps

### Real-time Features
- **500ms polling**: Ultra-low latency segment detection
- **File system monitoring**: Direct access to `LIVERESULTS` folder
- **HTTP fallback**: Alternative method for segment access
- **Auto-cleanup**: Memory management for blob URLs

### Download Process
1. **Segment collection**: Gather all segments in chronological order
2. **Blob creation**: Convert segments to video blobs
3. **Combination**: Merge all segments into single MP4 file
4. **Download**: Trigger browser download with progress tracking

## Browser Compatibility

### Required Features
- **File System Access API**: For direct folder monitoring
- **MediaRecorder API**: For video recording
- **Blob API**: For video processing
- **IndexedDB**: For fallback storage (optional)

### Supported Browsers
- Chrome 86+ (recommended)
- Firefox 78+
- Safari 14+ (limited features)

## Troubleshooting

### Live Viewer Not Connecting
1. Check if `LIVERESULTS` folder exists
2. Verify segments are being created
3. Check browser console for errors
4. Try refreshing the page

### Download Not Working
1. Ensure segments exist in `LIVERESULTS` folder
2. Check browser download settings
3. Verify sufficient disk space
4. Check browser console for errors

### Performance Issues
1. Reduce segment duration in `liveStreamer.js`
2. Increase polling interval in `live.html`
3. Check system resources
4. Close unnecessary browser tabs

## Advanced Configuration

### Customizing Segment Duration
Edit `liveStreamer.js` line 108:
```javascript
}, 6000); // Change from 6000ms to desired duration
```

### Adjusting Polling Frequency
Edit `live.html` line 189:
```javascript
}, 500); // Change from 500ms to desired frequency
```

### Modifying Video Quality
Edit `liveStreamer.js` lines 67-75:
```javascript
video: { 
    width: 1280, 
    height: 720,
    frameRate: 30,
    facingMode: 'user'
},
```

## License

This project is open source and available under the MIT License.