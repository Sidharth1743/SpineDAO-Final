import OpenAI from "openai";
import "dotenv/config";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chooseTwoRelevantKeywords(
  keywords: string[],
  findings: string[]
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `If I were to generate a novel hypothesis and want to test it. \
I have a list of keywords.\nTo ensure my hypothesis is novel, I want to choose two keywords that have not been used in a hypothesis before.\nWhich two keywords would you suggest I test first?\nYou should choose keywords that are relevant to the findings.\nMake sure you follow the exact same case as the keywords.\nEg. if a keyword is "Alzheimer disease", you should return "Alzheimer disease" not "alzheimer disease".\nOr if a keyword is "neurodegenerative diseases", you should return "neurodegenerative diseases" not "Neurodegenerative diseases".\nFollow the output format exactly.\nDO NOT include any other text in your response.\nINPUT:\nHere are the keywords: ${keywords.join(", ")}\nHere are the findings: ${findings.join(", ")}\nOUTPUT:\n[KEYWORD1, KEYWORD2]`,
      },
    ],
  });
  const text = completion.choices[0].message.content;
  if (text) return text;
  throw new Error("No text content found");
}

export async function chooseTwoRelevantFindings(
  findings: string[]
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `If I were to generate a novel hypothesis and want to test it. \
I have a list of findings.\nTo ensure my hypothesis is novel, I want to choose two findings that have not been used in a hypothesis before.\nWhich two findings would you suggest I test first?\nMake sure you follow the exact same case as the findings.\nEg. if a finding is "Alzheimer disease", you should return "Alzheimer disease" not "alzheimer disease".\nOr if a finding is "neurodegenerative diseases", you should return "neurodegenerative diseases" not "Neurodegenerative diseases".\nFollow the output format exactly.\nDO NOT include any other text in your response.\nINPUT:\nHere are the findings: ${findings.join(", ")}\nOUTPUT:\n[FINDING1;;;FINDING2]`,
      },
    ],
  });
  const text = completion.choices[0].message.content;
  if (text) return text;
  throw new Error("No text content found");
}
