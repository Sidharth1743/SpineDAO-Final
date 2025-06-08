import "dotenv/config";
import OpenAI from "openai";    

const apiKey: string | undefined = process.env.ANTHROPIC_API_KEY;

export function getClient(): OpenAI {
    return new OpenAI({ apiKey });
}

export async function generateResponse(
    client: OpenAI,
    prompt: string,
    model: string = "gpt-4o",
    maxTokens: number = 1500
): Promise<string> {
    let currentPrompt = prompt
    const response = await client.chat.completions.create({
        model: model,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: currentPrompt }],
    });

    if (
        response.choices &&
        response.choices.length > 0 &&
        response.choices[0].message.content
    ) {
        return response.choices[0].message.content;
    } else {
        throw new Error("No response received from OpenAI.");
    }
}