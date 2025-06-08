import "dotenv/config";
import OpenAI from "openai";
import { downloadPaperAndExtractDOI } from "./downloadPaper";
import { paperExists } from "./sparqlQueries";
import { logger } from "@elizaos/core";
import { makeLlamaIndexParseRequest } from "./unstructuredPartitioning";
import { processJsonArray, process_paper, create_graph } from "./processPaper";
import { getSummary, type Graph } from "./vectorize";
import { fromBuffer, fromPath } from "pdf2pic";
import fs from "fs";
import { categorizeIntoDAOsPrompt } from "./llmPrompt";
import DKG from "dkg.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type DKGClient = typeof DKG | null;

interface PaperArrayElement {
  metadata: {
    page_number: number;
    [key: string]: unknown;
  };
  text: string;
  [key: string]: unknown;
}

/**
 * Takes an array of JSON elements representing the paper's text
 * and returns a "knowledge assembly" (semantic graph) that includes
 * extracted metadata, citation info, subgraphs, and a summary.
 */
export async function jsonArrToKa(jsonArr: PaperArrayElement[], doi: string) {
  const client = openai;

  // Clean and validate input
  const validJsonArr = jsonArr.filter(el => {
    if (!el.text || typeof el.text !== 'string') {
      logger.warn('Invalid paper array element', { element: el });
      return false;
    }
    return true;
  });

  if (validJsonArr.length === 0) {
    throw new Error('No valid text content found in paper array');
  }

  // Process paper content with smart chunking
  const maxSectionLength = 50000; // Maximum characters per section
  const maxCitations = 100;       // Maximum citations to process
  
  const paperArrayDict = await processJsonArray(
    validJsonArr.map(el => ({
      ...el,
      text: el.text.slice(0, maxSectionLength) // Limit section length
    })), 
    client
  );

  // Process paper to get various components with optimized citations
  const paperDictWithLimitedCitations = {
    ...paperArrayDict,
    citations: paperArrayDict.citations.slice(0, maxCitations)
  };

  // Process components with error handling
  let basicInfo = '', citations = '', goSubgraph = '', doidSubgraph = '',
      chebiSubgraph = '', atcSubgraph = '';
  
  try {
    [
      basicInfo,
      citations,
      goSubgraph,
      doidSubgraph,
      chebiSubgraph,
      atcSubgraph,
    ] = await process_paper(client, paperDictWithLimitedCitations);
  } catch (error) {
    logger.error('Error processing paper components', { error });
    // Continue with partial results rather than failing completely
  }

  // Create core graph structure with error recovery
  const generatedGraph = await create_graph(
    client,
    basicInfo || '{}',  // Provide fallback empty objects
    citations || '[]',
    {
      go: goSubgraph || '[]',
      doid: doidSubgraph || '[]',
      chebi: chebiSubgraph || '[]',
      atc: atcSubgraph || '[]',
    }
  );

  // Add summary with error handling
  if (typeof generatedGraph === 'object' && generatedGraph !== null) {
    try {
      const graphForSummary: Graph = {
        ...generatedGraph as Record<string, unknown>,
        "dcterms:title": generatedGraph["dcterms:title"] as string | undefined,
        "@id": generatedGraph["@id"] as string | undefined
      };

      const summary = await getSummary(client, graphForSummary).catch(error => {
        logger.error('Error generating summary', { error });
        return ''; // Return empty string on error
      });

      if (summary) {
        generatedGraph["dcterms:hasPart"] = summary;
      }
    } catch (error) {
      logger.error('Error adding summary to graph', { error });
      // Continue without summary rather than failing
    }
  }

  // Set DOI identifier with validation
  if (doi) {
    try {
      // Clean and validate DOI
      const cleanDoi = doi.trim().replace(/^https?:\/\/doi\.org\/?/i, '');
      if (cleanDoi) {
        generatedGraph["@id"] = `https://doi.org/${cleanDoi}`;
      }
    } catch (error) {
      logger.error('Error setting DOI', { error, doi });
    }
  }

  // Ensure required namespaces are present
  try {
    const context = (generatedGraph["@context"] || {}) as Record<string, string>;
    generatedGraph["@context"] = context;

    // Add required namespaces if missing
    const requiredNamespaces = {
      "schema": "http://schema.org/",
      "dcterms": "http://purl.org/dc/terms/",
      "fabio": "http://purl.org/spar/fabio/",
    };

    for (const [prefix, uri] of Object.entries(requiredNamespaces)) {
      if (!(prefix in context)) {
        context[prefix] = uri;
        logger.info(`Added '${prefix}' namespace to @context in KA`);
      }
    }
  } catch (error) {
    logger.error('Error managing namespaces', { error });
  }

  // Validate final graph structure
  if (!generatedGraph["@type"]) {
    generatedGraph["@type"] = "fabio:ResearchPaper";
  }

  return generatedGraph;
}

/**
/**
/**
 * Recursively remove all colons (":") from string values in an object or array,
 * except for certain cases:
 *   1) Skip the entire "@context" object (do not remove colons from any values inside it).
 *   2) Skip any string where the key is "@type".
 *   3) Skip any string that appears to be a URL (starting with "http://", "https://", or "doi:").
 * @param data - The input data which can be an object, array, or primitive.
 * @param parentKey - The key of the parent property (used to check exceptions).
 * @returns A new object, array, or primitive with colons removed from allowed string values.
 */
function removeColonsRecursively<T>(data: T, parentKey?: string): T {
  // 1) If the parent key is "@context", return the data as-is (skip processing entirely)
  if (parentKey === "@context") {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) =>
      removeColonsRecursively(item, parentKey)
    ) as unknown as T;
  }

  // Handle objects
  if (data !== null && typeof data === "object") {
    const newObj: Record<string, unknown> = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        newObj[key] = removeColonsRecursively(
          (data as Record<string, unknown>)[key],
          key
        );
      }
    }
    return newObj as T;
  }

  // Handle strings
  if (typeof data === "string") {
    // 2) If this is the value of "@type", skip removing colons.
    if (parentKey === "@type") {
      return data as unknown as T;
    }

    // 3) If it's a URL/DOI (starts with http://, https://, or doi:), skip removing colons.
    if (/^(https?:\/\/|doi:)/i.test(data)) {
      return data as unknown as T;
    }

    // Otherwise, remove all colons
    return data.replace(/:/g, "") as unknown as T;
  }

  // For numbers, booleans, null, etc., just return as is
  return data;
}
const daoUals = {
  VitaDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101956",
  AthenaDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101957",
  PsyDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101958",
  ValleyDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101959",
  HairDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101961",
  CryoDAO:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101962",
  "Cerebrum DAO":
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101963",
  Curetopia:
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101964",
  "Long Covid Labs":
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101965",
  "Quantum Biology DAO":
    "did:dkg:base:84532/0xd5550173b0f7b8766ab2770e4ba86caf714a5af5/101966",
};

// Converts LlamaIndex Document<Metadata>[] to PaperArrayElement[]
function llamaIndexDocsToPaperArray(docs: any[]): PaperArrayElement[] {
  // Each doc: { text: string, metadata: { ... } }
  // Synthesize page_number if not present
  return docs.map((doc, idx) => ({
    text: doc.text,
    metadata: {
      page_number: doc.metadata?.page_number ?? idx + 1,
      ...doc.metadata,
    },
  }));
}

export async function generateKaFromPdf(pdfPath: string, dkgClient: DKGClient) {
  const options = {
    density: 100,
    format: "png",
    width: 595,
    height: 842,
  };
  const convert = fromPath(pdfPath, options);
  logger.info(`Converting ${pdfPath} to images`);

  const storeHandler = await convert.bulk(-1, { responseType: "base64" });

  const imageMessages = storeHandler
    .filter((page) => page.base64)
    .map((page) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: page.base64!,
      },
    }));
  logger.info(`Extracting DOI`);
  const doi = await extractDOIFromPDF(imageMessages);
  if (!doi) {
    throw new Error("Failed to extract DOI");
  }
  const paperExistsResult = await dkgClient.graph.query(
    paperExists(doi),
    "SELECT"
  );
  if (paperExistsResult.data) {
    logger.info(`Paper ${pdfPath} already exists in DKG, skipping`);
    return;
  } else {
    logger.info(`Paper ${pdfPath} does not exist in DKG, creating`);
  }
  // Use LlamaIndex for PDF parsing
  const paperArrayRaw = await makeLlamaIndexParseRequest(pdfPath);
  const paperArray = llamaIndexDocsToPaperArray(paperArrayRaw);
  const ka = await jsonArrToKa(paperArray, doi);
  const cleanedKa = removeColonsRecursively(ka);
  const relatedDAOsString = await categorizeIntoDAOs(imageMessages);

  const daos = JSON.parse(relatedDAOsString);

  const daoUalsMap = daos.map((dao) => {
    const daoUal = daoUals[dao];
    return {
      "@id": daoUal,
      "@type": "schema:Organization",
      "schema:name": dao,
    };
  });
  cleanedKa["schema:relatedTo"] = daoUalsMap;

  return cleanedKa;
}

export async function generateKaFromPdfBuffer(
  pdfBuffer: Buffer,
  dkgClient: DKGClient
) {
  const options = {
    density: 100,
    format: "png",
    width: 595,
    height: 842,
  };
  const convert = fromBuffer(pdfBuffer, options);

  // Convert PDF to images - process all pages
  const storeHandler = await convert.bulk(-1, { responseType: "base64" });

  // Process all pages without quality filtering
  let imageMessages = storeHandler
    .filter((page) => page.base64)
    .map((page, index) => ({
      type: "image" as const,
      source: {
        type: "base64" as const,
        media_type: "image/png" as const,
        data: page.base64!,
      },
      pageNumber: index + 1
    }));

  if (imageMessages.length === 0) {
    throw new Error("No valid images could be processed from PDF");
  }

  // Extract DOI with fallback options
  logger.info("Attempting DOI extraction...");
  let doi: string | null = null;
  
  // Try first page
  doi = await extractDOIFromPDF([imageMessages[0]]);
  
  // If no DOI found and we have more pages, try second page
  if (!doi && imageMessages.length > 1) {
    logger.info("Retrying DOI extraction on second page...");
    doi = await extractDOIFromPDF([imageMessages[1]]);
  }
  
  if (!doi) {
    logger.warn("No DOI found in PDF, will proceed with limited metadata");
    doi = `local-${Date.now()}`; // Generate temporary local identifier
  }

  // Write buffer to temporary file for LlamaIndex
  const tmpPath = `/tmp/ka-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  fs.writeFileSync(tmpPath, pdfBuffer);
  const paperArrayRaw = await makeLlamaIndexParseRequest(tmpPath);
  fs.unlinkSync(tmpPath);

  // Process paper content
  const paperArray = llamaIndexDocsToPaperArray(paperArrayRaw);
  const ka = await jsonArrToKa(paperArray, doi);
  const cleanedKa = removeColonsRecursively(ka);

  // Use all images for DAO categorization
  const relatedDAOsString = await categorizeIntoDAOs(imageMessages);
  const daos = JSON.parse(relatedDAOsString);

  // Map DAOs to their UALs
  const daoUalsMap = daos.map((dao) => ({
    "@id": daoUals[dao],
    "@type": "schema:Organization",
    "schema:name": dao,
  }));
  cleanedKa["schema:relatedTo"] = daoUalsMap;

  // Save sample output for debugging
  const randomId = Math.random().toString(36).substring(2, 15);
  const sampleDir = "sampleJsonLdsNew";
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true });
  }
  fs.writeFileSync(
    `${sampleDir}/ka-${randomId}.json`,
    JSON.stringify(cleanedKa, null, 2)
  );

  return cleanedKa;
}

export async function generateKaFromUrls(urls: [string]) {
  for (const url of urls) {
    const { pdfBuffer, doi } = await downloadPaperAndExtractDOI(url);
    if (!pdfBuffer) {
      throw new Error("Failed to download paper");
    }
    if (!doi) {
      throw new Error("Failed to extract DOI");
    }
    const tmpPath = `/tmp/ka-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
    fs.writeFileSync(tmpPath, pdfBuffer);
    const paperArrayRaw = await makeLlamaIndexParseRequest(tmpPath);
    fs.unlinkSync(tmpPath);
    const paperArray = llamaIndexDocsToPaperArray(paperArrayRaw);
    const ka = await jsonArrToKa(paperArray, doi);
    const cleanedKa = removeColonsRecursively(ka);
    return cleanedKa;
  }
}

// Image type for PDF page images
export interface Image {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/png";
    data: string;
  };
}

// Extract DOI from PDF images using OpenAI
// Patch: Limit images and truncate base64 for DOI extraction
async function extractDOIFromPDF(images: Image[]) {
  // Only use the first image (first page)
  const limitedImages = images.slice(0, 1).map(img => ({
    ...img,
    source: {
      ...img.source,
      // Truncate base64 to first 20,000 chars (adjust as needed)
      data: img.source.data.slice(0, 20000),
    },
  }));
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          "Extract the DOI from the paper. Only return the DOI, no other text.",
          ...limitedImages.map(img => `![image](data:${img.source.media_type};base64,${img.source.data})`)
        ].join("\n"),
      },
    ],
    max_tokens: 50,
  });
  return response.choices[0].message.content || undefined;
}

// Categorize into DAOs using OpenAI
async function categorizeIntoDAOs(images: Image[]) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: categorizeIntoDAOsPrompt,
      },
      {
        role: "user",
        content: images.map(img => `![image](data:${img.source.media_type};base64,${img.source.data})`).join("\n"),
      },
    ],
    max_tokens: 50,
  });
  return response.choices[0].message.content || undefined;
}
