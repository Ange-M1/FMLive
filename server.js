const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const SEGMENTS_DIR = path.join(__dirname, 'segments');
const MANIFESTS_DIR = path.join(__dirname, 'manifests');

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

// Serve static files for testing
app.use('/segments', express.static(SEGMENTS_DIR));
app.use('/manifests', express.static(MANIFESTS_DIR));

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
