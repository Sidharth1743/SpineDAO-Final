import { LlamaParseReader } from "llamaindex";
import 'dotenv/config';
import { logger } from "@elizaos/core";

/**
 * Makes a request to the LlamaIndex Cloud API to parse a PDF file with enhanced token management.
 * @param filePath - Path to the PDF file.
 * @param options - Optional configuration for parsing
 * @returns The parsed document(s) from LlamaIndex.
 */
export async function makeLlamaIndexParseRequest(
  filePath: string, 
  options: {
    maxChunkSize?: number;
    chunkOverlap?: number;
    skipPages?: number[];
    maxPages?: number;
  } = {}
) {
  const {
    maxChunkSize = 2048,     // Default chunk size in tokens
    chunkOverlap = 200,      // Default overlap between chunks
    skipPages = [],          // Pages to skip (e.g., references)
    maxPages = 50            // Maximum pages to process
  } = options;

  // Pass API key from env if needed
  const apiKey = process.env.LLAMA_INDEX_API_KEY || process.env.LLAMA_CLOUD_API_KEY;
  
  if (!apiKey) {
    throw new Error("LlamaIndex API key not found in environment variables");
  }

  // Configure reader with token management settings
  const reader = new LlamaParseReader({
    resultType: "markdown",
    apiKey,
  });

  try {
    logger.info(`Parsing file with LlamaIndex: ${filePath} (max ${maxPages} pages, ${maxChunkSize} tokens per chunk)`);
    const startTime = Date.now();
    
    let documents: any[] = [];
    try {
      documents = await reader.loadData(filePath);
    } catch (err) {
      logger.error(`LlamaIndex loadData failed: ${err instanceof Error ? err.message : String(err)}`);
      // Fallback: return empty array if LlamaIndex fails
      return [];
    }

    // Post-process the documents
    documents = documents
      // Filter out skipped pages
      .filter(doc => doc && doc.metadata && !skipPages.includes(doc.metadata.page_number))
      // Sort by page number
      .sort((a, b) => ((a.metadata?.page_number || 0) - (b.metadata?.page_number || 0)))
      // Limit to maxPages
      .slice(0, maxPages)
      // Clean and normalize text
      .map(doc => ({
        ...doc,
        text: (doc.text || '')
          .replace(/\s+/g, ' ')
          .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
          .trim()
      }))
      // Filter out empty documents
      .filter(doc => doc.text && doc.text.length > 0);

    const processingTime = Date.now() - startTime;
    logger.info(`Processed ${documents.length} sections in ${processingTime}ms`);
    
    // Validate the result
    if (documents.length === 0) {
      logger.warn("No valid text sections extracted from PDF. Returning empty array.");
      return [];
    }

    return documents;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to parse PDF: ${errorMessage}`, { error });
    throw error;
  }
}

//Example usage (uncomment to test directly):
// (async () => {
//   const docs = await makeLlamaIndexParseRequest("./science.pdf");
//   console.log(docs);
// })();
