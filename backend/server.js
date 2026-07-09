import express from 'express';
import cors from 'cors';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import dotenv from 'dotenv';
import aiService from './aiService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend
app.use(cors({
  origin: '*', // We can restrict this in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase JSON payload size limits for parsing large files
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Configure multer for memory storage uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * Helper: Parse CSV buffer into headers and rows
 * @param {Buffer} buffer 
 * @returns {Promise<{headers: string[], rows: Object[]}>}
 */
const parseCSVBuffer = (buffer) => {
  return new Promise((resolve, reject) => {
    const results = [];
    let headers = [];
    const stream = Readable.from(buffer.toString('utf-8'));

    stream
      .pipe(csvParser())
      .on('headers', (hdrList) => {
        headers = hdrList;
      })
      .on('data', (data) => results.push(data))
      .on('end', () => resolve({ headers, rows: results }))
      .on('error', (err) => reject(err));
  });
};

/**
 * Route: Check Server Health
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', provider: aiService.provider });
});

/**
 * Route: Upload CSV and return preview
 * POST /api/upload
 */
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { headers, rows } = await parseCSVBuffer(req.file.buffer);

    res.json({
      filename: req.file.originalname,
      totalRows: rows.length,
      headers,
      previewRows: rows.slice(0, 100) // Return first 100 rows for initial preview
    });
  } catch (err) {
    console.error('Error parsing CSV upload:', err);
    res.status(500).json({ error: 'Failed to parse CSV file: ' + err.message });
  }
});

/**
 * Route: Extract CRM fields from raw rows using streaming (NDJSON)
 * POST /api/extract
 */
app.post('/api/extract', async (req, res) => {
  const { headers, records, batchSize = 15 } = req.body;

  if (!headers || !records || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Missing headers or records array' });
  }

  // Set headers for Chunked / NDJSON transfer
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');

  const totalRecords = records.length;
  const totalBatches = Math.ceil(totalRecords / batchSize);

  let totalImported = 0;
  let totalSkipped = 0;

  try {
    for (let i = 0; i < totalBatches; i++) {
      const start = i * batchSize;
      const end = Math.min(start + batchSize, totalRecords);
      const batch = records.slice(start, end);

      let batchResults = [];
      let success = false;
      let retries = 3;

      while (!success && retries > 0) {
        try {
          batchResults = await aiService.processBatch(headers, batch);
          success = true;
        } catch (err) {
          retries--;
          console.warn(`Error processing batch ${i + 1}/${totalBatches}. Retries left: ${retries}. Error: ${err.message}`);
          if (retries === 0) {
            // If all retries fail, create fallback failed records so we don't crash
            batchResults = batch.map(r => ({
              created_at: new Date().toISOString(),
              name: r.name || r.Name || null,
              email: r.email || r.Email || null,
              country_code: null,
              mobile_without_country_code: null,
              crm_status: 'GOOD_LEAD_FOLLOW_UP',
              crm_note: `AI Extraction Failed: ${err.message}. Raw row data: ${JSON.stringify(r)}`,
              is_skipped: true // Mark as skipped since parsing failed
            }));
          } else {
            // Wait 1 second before retry to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Calculate skipped vs imported in this batch
      batchResults.forEach(record => {
        if (record.is_skipped) {
          totalSkipped++;
        } else {
          totalImported++;
        }
      });

      // Write progress chunk
      res.write(JSON.stringify({
        status: 'progress',
        batchIndex: i + 1,
        totalBatches,
        records: batchResults
      }) + '\n');
    }

    // Write final summary chunk
    res.write(JSON.stringify({
      status: 'complete',
      totalImported,
      totalSkipped,
      totalRecords
    }) + '\n');

    res.end();
  } catch (err) {
    console.error('Error during batch AI processing:', err);
    res.write(JSON.stringify({
      status: 'error',
      error: 'Extraction interrupted: ' + err.message
    }) + '\n');
    res.end();
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`GrowEasy CRM Importer Backend running on port ${PORT}`);
  console.log(`Active AI Provider: ${aiService.provider.toUpperCase()}`);
});
