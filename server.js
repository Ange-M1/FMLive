const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Configure middleware
app.use(express.json());
app.use(express.static('.'));

const SEGMENTS_DIR = path.join(__dirname, 'segments');
const MANIFESTS_DIR = path.join(__dirname, 'manifests');
const LIVERESULTS_DIR = path.join(__dirname, 'LIVERESULTS');

// Ensure directories exist
[SEGMENTS_DIR, MANIFESTS_DIR, LIVERESULTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Endpoint to upload and convert segment
app.post('/upload', upload.single('segment'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No segment file uploaded.');
  }

  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const baseName = path.parse(originalName).name;
  const outputPath = path.join(SEGMENTS_DIR, `${baseName}.ts`);

  // FFmpeg command to convert .webm to .ts segment
  const ffmpegCmd = `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset ultrafast -c:a aac -strict experimental -f mpegts "${outputPath}"`;

  exec(ffmpegCmd, (error, stdout, stderr) => {
    // Remove the uploaded .webm file after conversion
    fs.unlink(inputPath, () => {});

    if (error) {
      console.error(`FFmpeg error: ${stderr}`);
      return res.status(500).send('FFmpeg conversion failed.');
    }

    console.log(`Segment converted: ${baseName}.ts`);
    res.send(`Segment converted: ${baseName}.ts`);
  });
});

// Endpoint to generate manifest file
app.get('/generate_manifest', (req, res) => {
  fs.readdir(SEGMENTS_DIR, (err, files) => {
    if (err) return res.status(500).send('Failed to read segments directory.');

    // Filter only .ts files and sort by name
    const tsFiles = files.filter(f => f.endsWith('.ts')).sort();

    let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n';

    tsFiles.forEach(file => {
      manifest += '#EXTINF:2.0,\n' + file + '\n';
    });
    manifest += '#EXT-X-ENDLIST';

    // Write manifest to file
    const manifestPath = path.join(MANIFESTS_DIR, 'playlist.m3u8');
    fs.writeFile(manifestPath, manifest, err => {
      if (err) return res.status(500).send('Failed to write manifest file.');

      console.log('Manifest generated.');
      res.send('Manifest generated.');
    });
  });
});

// API endpoint to get list of available segments from LIVERESULTS
app.get('/api/segments', (req, res) => {
    try {
        if (!fs.existsSync(LIVERESULTS_DIR)) {
            return res.json([]);
        }

        const files = fs.readdirSync(LIVERESULTS_DIR);
        const segments = files
            .filter(file => file.endsWith('.ts') && file.startsWith('segment_'))
            .map(file => {
                const match = file.match(/segment_(\d+)\.ts/);
                if (match) {
                    const index = parseInt(match[1]);
                    const stats = fs.statSync(path.join(LIVERESULTS_DIR, file));
                    return {
                        filename: file,
                        index: index,
                        size: stats.size,
                        modified: stats.mtime
                    };
                }
                return null;
            })
            .filter(segment => segment !== null)
            .sort((a, b) => a.index - b.index);

        res.json(segments);
    } catch (error) {
        console.error('Error reading segments:', error);
        res.status(500).json({ error: 'Failed to read segments' });
    }
});

// API endpoint to get a specific segment file
app.get('/api/segments/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(LIVERESULTS_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Segment not found' });
    }
    
    res.sendFile(filePath);
});

// API endpoint to get the current manifest
app.get('/api/manifest', (req, res) => {
    try {
        const manifestPath = path.join(LIVERESULTS_DIR, 'playlist.m3u8');
        
        if (!fs.existsSync(manifestPath)) {
            return res.status(404).json({ error: 'Manifest not found' });
        }
        
        const manifest = fs.readFileSync(manifestPath, 'utf8');
        res.set('Content-Type', 'application/vnd.apple.mpegurl');
        res.send(manifest);
    } catch (error) {
        console.error('Error reading manifest:', error);
        res.status(500).json({ error: 'Failed to read manifest' });
    }
});

// API endpoint to get live stream status
app.get('/api/status', (req, res) => {
    try {
        if (!fs.existsSync(LIVERESULTS_DIR)) {
            return res.json({ isLive: false, segments: 0 });
        }

        const files = fs.readdirSync(LIVERESULTS_DIR);
        const segmentFiles = files.filter(file => file.endsWith('.ts') && file.startsWith('segment_'));
        
        // Check if there's been activity in the last 30 seconds
        let isLive = false;
        if (segmentFiles.length > 0) {
            const latestFile = segmentFiles.sort().pop();
            const latestPath = path.join(LIVERESULTS_DIR, latestFile);
            const stats = fs.statSync(latestPath);
            const timeSinceLastSegment = Date.now() - stats.mtime.getTime();
            isLive = timeSinceLastSegment < 30000; // 30 seconds
        }

        res.json({
            isLive: isLive,
            segments: segmentFiles.length,
            lastSegment: segmentFiles.length > 0 ? segmentFiles.sort().pop() : null
        });
    } catch (error) {
        console.error('Error getting status:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// Serve static files for testing
app.use('/segments', express.static(SEGMENTS_DIR));
app.use('/manifests', express.static(MANIFESTS_DIR));
app.use('/liveresults', express.static(LIVERESULTS_DIR));

// Serve the main HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'demoIndex.html'));
});

app.get('/live', (req, res) => {
    res.sendFile(path.join(__dirname, 'live.html'));
});

app.get('/test', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-api.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Live viewer available at http://localhost:${PORT}/live`);
    console.log(`LIVERESULTS directory: ${LIVERESULTS_DIR}`);
});
