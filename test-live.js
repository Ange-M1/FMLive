const fs = require('fs');
const path = require('path');

const LIVERESULTS_DIR = path.join(__dirname, 'LIVERESULTS');

// Ensure LIVERESULTS directory exists
if (!fs.existsSync(LIVERESULTS_DIR)) {
    fs.mkdirSync(LIVERESULTS_DIR, { recursive: true });
}

// Create a simple test segment (just a dummy file for testing)
function createTestSegment(index) {
    const filename = `segment_${index.toString().padStart(6, '0')}.ts`;
    const filePath = path.join(LIVERESULTS_DIR, filename);
    
    // Create a dummy segment file (in real scenario, this would be actual video data)
    const dummyData = Buffer.from(`# Test segment ${index} - This is dummy data for testing purposes.`.repeat(100));
    fs.writeFileSync(filePath, dummyData);
    
    console.log(`Created test segment: ${filename}`);
    return filename;
}

// Create test manifest
function createTestManifest(segmentCount) {
    let manifest = '#EXTM3U\n';
    manifest += '#EXT-X-VERSION:3\n';
    manifest += '#EXT-X-TARGETDURATION:6\n';
    manifest += '#EXT-X-MEDIA-SEQUENCE:0\n';
    
    for (let i = 0; i < segmentCount; i++) {
        const filename = `segment_${i.toString().padStart(6, '0')}.ts`;
        manifest += '#EXTINF:6.000000,\n';
        manifest += filename + '\n';
    }
    
    manifest += '#EXT-X-ENDLIST\n';
    
    const manifestPath = path.join(LIVERESULTS_DIR, 'playlist.m3u8');
    fs.writeFileSync(manifestPath, manifest);
    
    console.log(`Created test manifest with ${segmentCount} segments`);
}

// Simulate live stream by creating segments over time
function simulateLiveStream(duration = 30, segmentInterval = 6) {
    console.log(`Starting live stream simulation for ${duration} seconds...`);
    
    let segmentIndex = 0;
    const startTime = Date.now();
    
    const interval = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        
        if (elapsed >= duration) {
            clearInterval(interval);
            createTestManifest(segmentIndex);
            console.log(`Live stream simulation completed. Created ${segmentIndex} segments.`);
            return;
        }
        
        createTestSegment(segmentIndex);
        segmentIndex++;
        
    }, segmentInterval * 1000);
}

// Main execution
if (process.argv.includes('--simulate')) {
    const duration = parseInt(process.argv[process.argv.indexOf('--simulate') + 1]) || 30;
    simulateLiveStream(duration);
} else {
    // Create a few test segments for immediate testing
    console.log('Creating test segments...');
    for (let i = 0; i < 5; i++) {
        createTestSegment(i);
    }
    createTestManifest(5);
    console.log('Test setup complete. You can now test the live viewer.');
}

module.exports = { createTestSegment, createTestManifest, simulateLiveStream };