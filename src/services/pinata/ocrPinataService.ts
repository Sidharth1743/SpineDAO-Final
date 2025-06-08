import { processOcrText } from '../ocr/landingAI';
import { uploadToPinata, PinataResponse } from './client';
import { logger } from "@elizaos/core";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DigitizedResult {
  pinataResponse: PinataResponse;
  digitizedFilePath: string;
}

export async function processAndUploadDigitizedText(
  pdfBuffer: Buffer,
  originalFileName: string
): Promise<DigitizedResult> {
  let tempPdfPath: string | null = null;
  
  try {
    // Check for required environment variables
    if (!process.env.VISION_AGENT_API_KEY) {
      throw new Error("VISION_AGENT_API_KEY environment variable is not set");
    }

    // Create temp file for PDF
    tempPdfPath = path.join('/tmp', `temp-${Date.now()}-${originalFileName}`);
    fs.writeFileSync(tempPdfPath, pdfBuffer);
    logger.info(`Created temporary PDF file at: ${tempPdfPath}`);

    // Process through OCR
    logger.info(`Starting OCR processing for ${originalFileName}`);
    const ocrResult = await processOcrText(tempPdfPath);
    logger.info(`OCR processing completed for ${originalFileName}`);

    // Generate digitized text filename
    const baseName = path.parse(originalFileName).name;
    const digitizedFileName = `${baseName}-digitized.txt`;
    const digitizedFilePath = path.join('digitized', digitizedFileName);

    // Ensure digitized directory exists
    if (!fs.existsSync('digitized')) {
      logger.info('Creating digitized directory');
      fs.mkdirSync('digitized', { recursive: true });
    }

    // Save digitized text
    logger.info(`Saving digitized text to: ${digitizedFilePath}`);
    fs.writeFileSync(digitizedFilePath, ocrResult.cleanedText);

    // Upload digitized text to Pinata
    logger.info(`Uploading digitized text to Pinata: ${digitizedFileName}`);
    const digitizedBuffer = Buffer.from(ocrResult.cleanedText);
    const pinataResponse = await uploadToPinata(digitizedBuffer, digitizedFileName);

    // Clean up temp file
    if (tempPdfPath) {
      logger.info(`Cleaning up temporary file: ${tempPdfPath}`);
      fs.unlinkSync(tempPdfPath);
    }

    logger.info(`Successfully processed and uploaded digitized text for ${originalFileName}`);
    logger.info(`Digitized file saved at: ${digitizedFilePath}`);
    logger.info(`Pinata IPFS Hash: ${pinataResponse.IpfsHash}`);

    return {
      pinataResponse,
      digitizedFilePath
    };
  } catch (error) {
    logger.error('Error in processAndUploadDigitizedText:', error);
    // Clean up temp file if it exists
    if (tempPdfPath && fs.existsSync(tempPdfPath)) {
      try {
        fs.unlinkSync(tempPdfPath);
      } catch (cleanupError) {
        logger.error('Error cleaning up temporary file:', cleanupError);
      }
    }
    throw error;
  }
} 