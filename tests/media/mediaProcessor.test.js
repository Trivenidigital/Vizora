const request = require('supertest');
const { app } = require('../mocks/app');
const { connectDB, disconnectDB, clearDatabase } = require('../../database');
const path = require('path');
const fs = require('fs').promises;

describe('Media Processing', () => {
  beforeAll(async () => {
    await connectDB();
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe('Image Processing', () => {
    it('should process and optimize an uploaded image', async () => {
      const testImagePath = path.join(__dirname, '../fixtures/test-image.jpg');
      
      const response = await request(app)
        .post('/api/media/process')
        .attach('image', testImagePath)
        .field('optimization', 'high')
        .expect(200);

      expect(response.body).toHaveProperty('processedUrl');
      expect(response.body).toHaveProperty('originalSize');
      expect(response.body).toHaveProperty('optimizedSize');
      expect(response.body.optimizedSize).toBeLessThan(response.body.originalSize);
    });

    it('should handle invalid image formats', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/invalid.txt');
      
      const response = await request(app)
        .post('/api/media/process')
        .attach('image', testFilePath)
        .expect(400);

      expect(response.body.error).toBe('Invalid file format');
    });
  });

  describe('Video Processing', () => {
    it('should process and transcode a video file', async () => {
      const testVideoPath = path.join(__dirname, '../fixtures/test-video.mp4');
      
      const response = await request(app)
        .post('/api/media/transcode')
        .attach('video', testVideoPath)
        .field('format', 'webm')
        .expect(200);

      expect(response.body).toHaveProperty('transcodedUrl');
      expect(response.body).toHaveProperty('duration');
      expect(response.body).toHaveProperty('format', 'webm');
    });

    it('should handle large video files with chunked upload', async () => {
      const testLargeVideoPath = path.join(__dirname, '../fixtures/large-video.mp4');
      const chunkSize = 1024 * 1024; // 1MB chunks
      
      const fileStats = await fs.stat(testLargeVideoPath);
      const totalChunks = Math.ceil(fileStats.size / chunkSize);
      
      let uploadId;
      
      // Initiate upload
      const initResponse = await request(app)
        .post('/api/media/upload/init')
        .send({
          filename: 'large-video.mp4',
          totalSize: fileStats.size,
          totalChunks
        })
        .expect(200);
      
      uploadId = initResponse.body.uploadId;
      
      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileStats.size);
        
        await request(app)
          .post(`/api/media/upload/chunk/${uploadId}`)
          .field('chunkIndex', i)
          .attach('chunk', testLargeVideoPath, {
            start,
            end
          })
          .expect(200);
      }
      
      // Complete upload
      const completeResponse = await request(app)
        .post(`/api/media/upload/complete/${uploadId}`)
        .expect(200);
      
      expect(completeResponse.body).toHaveProperty('url');
      expect(completeResponse.body).toHaveProperty('size', fileStats.size);
    });
  });

  describe('Media Conversion', () => {
    it('should convert media to different formats', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg');
      
      const response = await request(app)
        .post('/api/media/convert')
        .attach('file', testFilePath)
        .field('targetFormat', 'webp')
        .expect(200);

      expect(response.body).toHaveProperty('convertedUrl');
      expect(response.body.convertedUrl).toMatch(/\.webp$/);
    });

    it('should handle unsupported conversion formats', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/test-image.jpg');
      
      const response = await request(app)
        .post('/api/media/convert')
        .attach('file', testFilePath)
        .field('targetFormat', 'unsupported')
        .expect(400);

      expect(response.body.error).toBe('Unsupported conversion format');
    });
  });
}); 