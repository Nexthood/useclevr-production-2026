import { debugLog, debugError, debugWarn } from "@/lib/debug"

// ============================================================================
// UPLOAD & STORAGE HANDLER - S3/Cloudflare R2 Integration
// ============================================================================
// Handles file uploads to durable storage (S3 or Cloudflare R2)
// Returns dataset metadata for database record creation
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// TYPES
// ============================================================================

export interface UploadConfig {
  provider: 's3' | 'r2' | 'local';
  bucket?: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
}

export interface UploadResult {
  success: boolean;
  datasetId: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  checksum?: string;
  error?: string;
}

export interface DatasetMetadata {
  id: string;
  filename: string;
  storageKey: string;
  fileSize: number;
  mimeType: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  uploadTimestamp: string;
  checksum?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get upload configuration from environment
 */
export function getUploadConfig(): UploadConfig {
  const provider = process.env.UPLOAD_PROVIDER as UploadConfig['provider'] || 'local';
  
  if (provider === 's3') {
    return {
      provider: 's3',
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }
  
  if (provider === 'r2') {
    return {
      provider: 'r2',
      bucket: process.env.R2_BUCKET,
      endpoint: process.env.R2_ENDPOINT,
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      publicUrl: process.env.R2_PUBLIC_URL,
    };
  }
  
  return { provider: 'local' };
}

// ============================================================================
// UPLOAD FUNCTIONS
// ============================================================================

/**
 * Generate storage key for file
 */
function generateStorageKey(datasetId: string, filename: string): string {
  const timestamp = Date.now();
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `datasets/${datasetId}/${timestamp}-${sanitizedFilename}`;
}

/**
 * Calculate MD5 checksum (simple implementation)
 */
async function calculateChecksum(buffer: Buffer): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('md5').update(buffer).digest('hex');
}

/**
 * Upload file to S3
 */
async function uploadToS3(
  buffer: Buffer,
  key: string,
  mimeType: string,
  config: UploadConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const client = new S3Client({
      region: config.region,
      credentials: config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
    });
    
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    
    return { success: true };
  } catch (error: any) {
    debugError('[UPLOAD] S3 upload failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload file to Cloudflare R2
 */
async function uploadToR2(
  buffer: Buffer,
  key: string,
  mimeType: string,
  config: UploadConfig
): Promise<{ success: boolean; error?: string }> {
  try {
    // R2 uses S3-compatible API
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const client = new S3Client({
      endpoint: config.endpoint,
      region: 'auto',
      credentials: config.accessKeyId && config.secretAccessKey
        ? {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          }
        : undefined,
    });
    
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    
    return { success: true };
  } catch (error: any) {
    debugError('[UPLOAD] R2 upload failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload file to local storage (fallback)
 */
async function uploadToLocal(
  buffer: Buffer,
  key: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Use /tmp for local storage (or custom path)
    const uploadDir = process.env.LOCAL_UPLOAD_DIR || '/tmp/useclevr-uploads';
    const fullPath = path.join(uploadDir, key);
    
    // Create directory if it doesn't exist
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    await fs.writeFile(fullPath, buffer);
    
    return { success: true };
  } catch (error: any) {
    debugError('[UPLOAD] Local upload failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Upload file to durable storage
 * @param buffer - File buffer
 * @param filename - Original filename
 * @param mimeType - MIME type
 * @returns Upload result with dataset ID and storage key
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<UploadResult> {
  const config = getUploadConfig();
  const datasetId = uuidv4();
  const storageKey = generateStorageKey(datasetId, filename);
  
  debugLog(`[UPLOAD] Uploading ${filename} (${buffer.length} bytes) to ${config.provider}`);
  
  let uploadResult: { success: boolean; error?: string };
  
  switch (config.provider) {
    case 's3':
      uploadResult = await uploadToS3(buffer, storageKey, mimeType, config);
      break;
    case 'r2':
      uploadResult = await uploadToR2(buffer, storageKey, mimeType, config);
      break;
    default:
      uploadResult = await uploadToLocal(buffer, storageKey);
  }
  
  if (!uploadResult.success) {
    return {
      success: false,
      datasetId,
      storageKey,
      fileSize: buffer.length,
      mimeType,
      error: uploadResult.error,
    };
  }
  
  // Calculate checksum
  const checksum = await calculateChecksum(buffer);
  
  debugLog(`[UPLOAD] Successfully uploaded to ${storageKey}`);
  
  return {
    success: true,
    datasetId,
    storageKey,
    fileSize: buffer.length,
    mimeType,
    checksum,
  };
}

/**
 * Get public URL for uploaded file
 */
export function getFileUrl(storageKey: string): string {
  const config = getUploadConfig();
  
  if (config.provider === 's3' && config.bucket) {
    return `https://${config.bucket}.s3.${config.region}.amazonaws.com/${storageKey}`;
  }
  
  if (config.provider === 'r2' && config.publicUrl) {
    return `${config.publicUrl}/${storageKey}`;
  }
  
  if (config.provider === 'local') {
    const baseUrl = process.env.LOCAL_UPLOAD_URL || '/uploads';
    return `${baseUrl}/${storageKey}`;
  }
  
  return storageKey;
}

/**
 * Delete file from storage
 */
export async function deleteFile(storageKey: string): Promise<boolean> {
  const config = getUploadConfig();
  
  try {
    if (config.provider === 's3') {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ region: config.region });
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    } else if (config.provider === 'r2') {
      const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({ endpoint: config.endpoint, region: 'auto' });
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: storageKey }));
    } else {
      const fs = await import('fs/promises');
      const path = await import('path');
      const uploadDir = process.env.LOCAL_UPLOAD_DIR || '/tmp/useclevr-uploads';
      await fs.unlink(path.join(uploadDir, storageKey));
    }
    
    debugLog(`[UPLOAD] Deleted file: ${storageKey}`);
    return true;
  } catch (error: any) {
    debugError('[UPLOAD] Delete failed:', error);
    return false;
  }
}

// ============================================================================
// PARSE CSV/EXCEL FROM UPLOAD
// ============================================================================

/**
 * Parse uploaded CSV file
 */
export async function parseCSVFile(buffer: Buffer): Promise<{
  rows: Record<string, any>[];
  columns: string[];
  rowCount: number;
  columnCount: number;
}> {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('Empty CSV file');
  }
  
  // Parse header
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: Record<string, any>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, any> = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    rows.push(row);
  }
  
  return {
    rows,
    columns: headers,
    rowCount: rows.length,
    columnCount: headers.length,
  };
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Parse uploaded Excel file (basic support)
 * Note: For full Excel support, use 'xlsx' package
 */
export async function parseExcelFile(buffer: Buffer): Promise<{
  rows: Record<string, any>[];
  columns: string[];
  rowCount: number;
  columnCount: number;
}> {
  // Basic XLSX parsing - in production, use 'xlsx' package
  // This is a placeholder that converts to CSV-like parsing
  debugLog('[UPLOAD] Excel parsing not fully implemented, treating as CSV');
  return parseCSVFile(buffer);
}

/**
 * Detect MIME type from filename
 */
export function detectMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  
  const mimeTypes: Record<string, string> = {
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    xls: 'application/vnd.ms-excel',
    tsv: 'text/tab-separated-values',
    json: 'application/json',
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Process uploaded file
 * @param buffer - File buffer
 * @param filename - Original filename
 * @returns Processed dataset metadata
 */
export async function processUploadedFile(
  buffer: Buffer,
  filename: string
): Promise<DatasetMetadata> {
  const mimeType = detectMimeType(filename);
  
  // Upload to storage
  const uploadResult = await uploadFile(buffer, filename, mimeType);
  
  if (!uploadResult.success) {
    throw new Error(`Upload failed: ${uploadResult.error}`);
  }
  
  // Parse file content
  let parsed;
  if (mimeType === 'text/csv' || mimeType === 'text/tab-separated-values') {
    parsed = await parseCSVFile(buffer);
  } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    parsed = await parseExcelFile(buffer);
  } else {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  
  return {
    id: uploadResult.datasetId,
    filename,
    storageKey: uploadResult.storageKey,
    fileSize: uploadResult.fileSize,
    mimeType: uploadResult.mimeType,
    rowCount: parsed.rowCount,
    columnCount: parsed.columnCount,
    columns: parsed.columns,
    uploadTimestamp: new Date().toISOString(),
    checksum: uploadResult.checksum,
  };
}
