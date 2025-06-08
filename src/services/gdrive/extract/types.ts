import OpenAI from "openai";
import { InstructorClient as IC } from "@instructor-ai/instructor";

export type OpenAIImage = {
  type: "image_url";
  image_url: {
    url: string;
  };
};

export type InstructorClient = IC<OpenAI>;
