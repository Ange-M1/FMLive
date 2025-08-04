class LiveStreamer {
    constructor() {
        this.mediaRecorder = null;
        this.stream = null;
        this.segments = [];
        this.segmentIndex = 0;
        this.isRecording = false;
        this.startTime = null;
        this.segmentInterval = null;
        this.timeInterval = null;
        this.manifestContent = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n';
        this.savedCount = 0;
        this.totalSizeBytes = 0;
        
        this.initElements();
        this.initIndexedDB();
    }

    initElements() {
        this.videoPlayer = document.getElementById('videoPlayer');
        this.startButton = document.getElementById('startLive');
        this.endButton = document.getElementById('endLive');
        this.status = document.getElementById('status');
        this.segmentCount = document.getElementById('segmentCount');
        this.recordingTime = document.getElementById('recordingTime');
        this.savedCountEl = document.getElementById('savedCount');
        this.totalSizeEl = document.getElementById('totalSize');
        this.saveLog = document.getElementById('saveLog');

        // Mirror effect for front camera
        this.videoPlayer.style.transform = 'scaleX(-1)';

        this.startButton.addEventListener('click', () => this.startLive());
        this.endButton.addEventListener('click', () => this.endLive());
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('LiveStreamDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                this.addLogEntry('IndexedDB initialized successfully');
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('segments')) {
                    db.createObjectStore('segments', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('manifests')) {
                    db.createObjectStore('manifests', { keyPath: 'id' });
                }
            };
        });
    }

    async startLive() {
        try {
            this.segments = [];
            this.segmentIndex = 0;
            this.savedCount = 0;
            this.totalSizeBytes = 0;
            this.manifestContent = '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n';
            
            this.addLogEntry('Starting live stream...');
            
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 1280, 
                    height: 720,
                    frameRate: 30,
                    facingMode: 'user'
                },
                audio: true
            });

            this.videoPlayer.srcObject = this.stream;
            
            const options = {
                mimeType: 'video/webm;codecs=vp8,opus',
                videoBitsPerSecond: 2000000,
                audioBitsPerSecond: 128000
            };

            this.mediaRecorder = new MediaRecorder(this.stream, options);
            this.setupRecorder();
            
            this.mediaRecorder.start();
            this.startSegmentation();
            this.updateUI(true);
            
            this.addLogEntry('Live recording started - Auto-saving enabled');
            
        } catch (error) {
            console.error('Error:', error);
            this.status.textContent = 'Error: Cannot access camera';
            this.addLogEntry('Error: ' + error.message);
        }
    }

    setupRecorder() {
        let chunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = async () => {
            if (chunks.length > 0) {
                const blob = new Blob(chunks, { type: 'video/webm' });
                await this.createSegment(blob);
                chunks = [];
            }
        };
    }

    startSegmentation() {
        this.startTime = Date.now();
        this.isRecording = true;
        
        // Create 6-second segments
        this.segmentInterval = setInterval(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
                setTimeout(() => {
                    if (this.isRecording) {
                        this.mediaRecorder.start();
                    }
                }, 100);
            }
        }, 6000);

        this.timeInterval = setInterval(() => {
            this.updateRecordingTime();
        }, 1000);
    }

    async createSegment(blob) {
        const segmentId = `segment_${this.segmentIndex.toString().padStart(6, '0')}.ts`;
        const segment = {
            id: segmentId,
            data: blob,
            timestamp: Date.now(),
            duration: 6.0,
            index: this.segmentIndex
        };

        this.segments.push(segment);
        this.totalSizeBytes += blob.size;

        // Store in IndexedDB
        const segmentForDB = {
            id: segmentId,
            data: await this.blobToArrayBuffer(blob),
            timestamp: segment.timestamp,
            duration: segment.duration,
            index: segment.index,
            size: blob.size
        };
        
        await this.storeInIndexedDB('segments', segmentForDB);

        // Auto-save segment to LIVERSULTS folder
        await this.autoSaveSegment(segment);

        // Update manifest content in memory (don't save yet)
        this.manifestContent += `#EXTINF:6.0,\n${segmentId}\n`;
        await this.updateManifestInDB();

        this.segmentIndex++;
        this.updateSegmentInfo();
        
        const sizeKB = (blob.size / 1024).toFixed(1);
        this.addLogEntry('Auto-saved segment: ' + segmentId + ' (' + sizeKB + ' KB)');
        this.addLogEntry('Manifest updated in memory (' + this.segments.length + ' segments)');
    }

    async autoSaveSegment(segment) {
        try {
            // Create download link for auto-save
            const url = URL.createObjectURL(segment.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = segment.id;
            a.style.display = 'none';
            
            // Auto-trigger download
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.savedCount++;
            
        } catch (error) {
            this.addLogEntry('Failed to save ' + segment.id + ': ' + error.message);
        }
    }

    async autoSaveManifest() {
        try {
            // Create final HLS manifest with ALL segments
            let manifest = '#EXTM3U\n';
            manifest += '#EXT-X-VERSION:3\n';
            manifest += '#EXT-X-TARGETDURATION:6\n';
            manifest += '#EXT-X-MEDIA-SEQUENCE:0\n';
            manifest += '#EXT-X-PLAYLIST-TYPE:VOD\n';
            
            // Add ALL segments to the manifest
            for (let i = 0; i < this.segments.length; i++) {
                manifest += '#EXTINF:6.000000,\n';
                manifest += this.segments[i].id + '\n';
            }
            
            // Add ENDLIST to indicate this is a complete playlist
            manifest += '#EXT-X-ENDLIST\n';

            // Download the final manifest file (ONLY ONCE at the end)
            const manifestBlob = new Blob([manifest], { type: 'application/vnd.apple.mpegurl' });
            const url = URL.createObjectURL(manifestBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'playlist.m3u8';
            a.style.display = 'none';
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            console.log('Final manifest content:', manifest);
            
        } catch (error) {
            this.addLogEntry('Failed to save final manifest: ' + error.message);
        }
    }

    async blobToArrayBuffer(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(blob);
        });
    }

    async updateManifestInDB() {
        const manifest = {
            id: 'current_manifest',
            content: this.manifestContent,
            timestamp: Date.now(),
            segmentCount: this.segments.length
        };
        
        await this.storeInIndexedDB('manifests', manifest);
    }

    async storeInIndexedDB(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async endLive() {
        this.isRecording = false;

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        clearInterval(this.segmentInterval);
        clearInterval(this.timeInterval);

        // NOW save the final manifest with all segments (ONLY download at the end)
        await this.autoSaveManifest();

        this.updateUI(false);
        this.addLogEntry('Recording ended. Total: ' + this.segments.length + ' segments auto-saved');
        this.addLogEntry('FINAL manifest downloaded with all ' + this.segments.length + ' segments');
    }

    updateUI(isLive) {
        this.startButton.disabled = isLive;
        this.endButton.disabled = !isLive;
        
        if (isLive) {
            this.status.textContent = 'LIVE - Recording & Auto-Saving...';
        } else {
            if (this.segments.length > 0) {
                this.status.textContent = 'Recording ended - ' + this.segments.length + ' segments auto-saved';
            } else {
                this.status.textContent = 'Ready to go live';
            }
            this.videoPlayer.srcObject = null;
        }
    }

    updateRecordingTime() {
        if (this.startTime) {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            this.recordingTime.textContent = minutes + ':' + seconds;
        }
    }

    updateSegmentInfo() {
        this.segmentCount.textContent = this.segments.length;
        this.savedCountEl.textContent = this.savedCount;
        this.totalSizeEl.textContent = (this.totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    addLogEntry(message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.textContent = '[' + timestamp + '] ' + message;
        
        this.saveLog.appendChild(logEntry);
        this.saveLog.scrollTop = this.saveLog.scrollHeight;
        
        // Keep only last 50 entries
        while (this.saveLog.children.length > 50) {
            this.saveLog.removeChild(this.saveLog.firstChild);
        }
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    new LiveStreamer();
});