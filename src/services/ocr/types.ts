export interface Chunk {
  text: string;
  [key: string]: any;
}

export interface DocumentResult {
  chunks: Chunk[];
  [key: string]: any;
}

export interface TableData {
  html: string;
  dataframe?: any; // We'll use a more specific type when we implement the table processing
}

export interface ProcessedText {
  cleanedText: string;
  tables: TableData[];
  dataframes: any[]; // We'll use a more specific type when we implement the table processing
} 