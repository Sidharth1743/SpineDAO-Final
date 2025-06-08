// vectorize.ts

import { get_prompt_vectorization_summary } from "./llmPrompt";
import { generateResponse } from "./anthropicClient"; // Now uses OpenAI
import OpenAI from "openai";
import { logger } from "@elizaos/core";

/**
 * The general structure of your graph object. Extend with any additional fields you need.
 */
export interface Graph {
  [key: string]: unknown;
  "dcterms:title"?: string;
  "@id"?: string;
}

/**
 * A single citation entry. Adjust if your citation objects have more fields.
 */
interface CitationEntry {
  [key: string]: unknown;
  "@id": string;
  "dcterms:title": string;
}

/**
 * The shape returned by findSimilarTitle. The second element is a similarity score (0-1).
 * The first element's metadata presumably includes a "doi" string.
 */
interface SimilarCitationResult {
  metadata: { [key: string]: string };
}

/**
 * Generate a summary for the provided graph using the LLM client.
 * @param client - The client or config object for your LLM
 * @param graph  - The graph/dictionary containing paper metadata
 */
export async function getSummary(
  client: OpenAI,
  graph: Graph
): Promise<string> {
  let summary = "";
  try {
    const prompt = get_prompt_vectorization_summary(graph);
    summary = await generateResponse(client, prompt, "gpt-4o");
    logger.info(`Generated graph summary from OpenAI: ${summary}`);
  } catch (error) {
    logger.error("Generated graph summary exception", error);
    summary = "";
  }
  return summary;
}
