import { spawn } from 'child_process';
import { ProcessedText } from './types';
import { logger } from "@elizaos/core";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Get the absolute path to the src directory
const SRC_DIR = path.resolve(__dirname, '../../..');
const OCR_SCRIPT_PATH = path.join(SRC_DIR,'plugin','plugin-bioagent','src', 'services', 'ocr', 'ocr.py');

logger.info(`OCR script path: ${OCR_SCRIPT_PATH}`);

// Function to run Python script and get results
async function runPythonScript(pdfPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    logger.info(`Running OCR script on ${pdfPath}`);
    logger.info(`Using Python script at: ${OCR_SCRIPT_PATH}`);

    // Verify the script exists
    if (!fs.existsSync(OCR_SCRIPT_PATH)) {
      const scriptError = new Error(`OCR script not found at ${OCR_SCRIPT_PATH}`);
      logger.error(scriptError);
      reject(scriptError);
      return;
    }

    const pythonProcess = spawn('python3', [OCR_SCRIPT_PATH, pdfPath]);
    let outputPath = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      // Only take the last line of output as the file path
      const lines = output.split('\n');
      outputPath = lines[lines.length - 1];
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        const processError = new Error(`Python script failed with code ${code}: ${errorOutput}`);
        logger.error('Error processing OCR text:', processError);
        reject(processError);
        return;
      }

      if (!outputPath) {
        reject(new Error('No output file path received from Python script'));
        return;
      }

      // Verify the file exists
      if (!fs.existsSync(outputPath)) {
        reject(new Error(`Output file not found at: ${outputPath}`));
        return;
      }

      resolve(outputPath);
    });
  });
}

// Main function to process OCR text
export async function processOcrText(pdfPath: string): Promise<ProcessedText> {
  try {
    // Run Python script to get the path of the digitized text file
    const digitizedFilePath = await runPythonScript(pdfPath);
    
    // Read the digitized text file
    const textContent = fs.readFileSync(digitizedFilePath, 'utf-8');
    
    return {
      cleanedText: textContent,
      tables: [], // Tables are now part of the text content
      dataframes: []
    };
  } catch (error) {
    logger.error('Error processing OCR text:', error);
    throw error;
  }
} 