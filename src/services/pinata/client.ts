import axios from 'axios';
import FormData from 'form-data';
import { logger } from "@elizaos/core";
import dotenv from "dotenv";
dotenv.config();

export interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
}

export async function uploadToPinata(
  file: Buffer,
  fileName: string,
  contentType: string = 'text/plain'
): Promise<PinataResponse> {
  try {
    const apiKey = process.env.PINATA_API_KEY;
    const apiSecret = process.env.PINATA_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("Pinata API credentials are not set in environment variables.");
    }

    const formData = new FormData();
    formData.append('file', file, {
      filename: fileName,
      contentType: contentType
    });

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'pinata_api_key': apiKey,
          'pinata_secret_api_key': apiSecret,
        },
      }
    );

    return response.data;
  } catch (error) {
    logger.error('Error uploading to Pinata:', error);
    throw error;
  }
} 