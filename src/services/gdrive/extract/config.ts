import "dotenv/config";
import OpenAI from "openai";
import Instructor, { InstructorClient as IC } from "@instructor-ai/instructor";
import path from "path";
import fs from "fs";

const __dirname = path.resolve();

export default class Config {
  private static _instance: Config;
  private static _openaiClient: OpenAI;
  private static _instructorOai: IC<OpenAI>;
  private static _openaiModel: string = process.env.OPENAI_MODEL || "gpt-4o";
  private static _papersDirectory: string = path.join(__dirname, "papers");
  private static _pdf2PicOptions: any = {
    density: 100,
    format: "png",
    width: 595,
    height: 842,
  };

  private constructor() {}

  private static initialize() {
    if (!this._openaiClient) {
      this._openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    if (!this._instructorOai) {
      this._instructorOai = Instructor({
        client: this._openaiClient,
        mode: "JSON",
      });
    }

    if (!fs.existsSync(this._papersDirectory)) {
      fs.mkdirSync(this._papersDirectory, { recursive: true });
    } else if (!fs.lstatSync(this._papersDirectory).isDirectory()) {
      throw new Error(
        `The specified papers path "${this._papersDirectory}" is not a directory.`
      );
    }
  }

  private static getInstance(): Config {
    if (!this._instance) {
      this._instance = new Config();
      this.initialize();
    }
    return this._instance;
  }

  public static get openaiClient(): OpenAI {
    this.getInstance();
    return this._openaiClient;
  }

  public static get openaiModel(): string {
    this.getInstance();
    return this._openaiModel;
  }

  public static set openaiModel(model: string) {
    this.getInstance();
    this._openaiModel = model;
  }

  public static get papersDirectory(): string {
    this.getInstance();
    return this._papersDirectory;
  }

  public static set papersDirectory(directory: string) {
    this.getInstance();
    this._papersDirectory = directory;
  }

  public static get pdf2PicOptions() {
    this.getInstance();
    return this._pdf2PicOptions;
  }

  public static set pdf2PicOptions(options: any) {
    this.getInstance();
    this._pdf2PicOptions = options;
  }

  public static get instructorOai() {
    this.getInstance();
    return this._instructorOai;
  }
}
