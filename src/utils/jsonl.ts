import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Utility functions for handling JSONL (JSON Lines) files
 */

export interface JSONLReadOptions {
  encoding?: BufferEncoding;
  skipEmpty?: boolean;
  validate?: boolean;
}

/**
 * Read and parse a JSONL file, returning an array of parsed objects
 */
export function readJSONL<T = any>(filePath: string, options: JSONLReadOptions = {}): T[] {
  const {
    encoding = 'utf-8',
    skipEmpty = true,
    validate = true
  } = options;

  if (!existsSync(filePath)) {
    throw new Error(`JSONL file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, encoding);
  const lines = content.split('\n');
  const results: T[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines if requested
    if (skipEmpty && !line) {
      continue;
    }

    try {
      const parsed = JSON.parse(line);
      results.push(parsed);
    } catch (error) {
      if (validate) {
        throw new Error(`Invalid JSON on line ${i + 1} in ${filePath}: ${error}`);
      }
      // Skip invalid lines if validation is disabled
      console.warn(`Skipping invalid JSON on line ${i + 1} in ${filePath}: ${line}`);
    }
  }

  return results;
}

/**
 * Convert a JSON array to JSONL format string
 */
export function arrayToJSONL<T = any>(data: T[]): string {
  return data.map(item => JSON.stringify(item)).join('\n');
}

/**
 * Write an array of objects to a JSONL file
 */
export function writeJSONL<T = any>(filePath: string, data: T[], encoding: BufferEncoding = 'utf-8'): void {
  const content = arrayToJSONL(data);
  require('fs').writeFileSync(filePath, content, encoding);
}

/**
 * Append a single object to an existing JSONL file
 */
export function appendToJSONL<T = any>(filePath: string, item: T, encoding: BufferEncoding = 'utf-8'): void {
  const line = JSON.stringify(item) + '\n';
  require('fs').appendFileSync(filePath, line, encoding);
}

/**
 * Stream read JSONL file line by line (generator function)
 */
export function* streamJSONL<T = any>(filePath: string, options: JSONLReadOptions = {}): Generator<T, void, unknown> {
  const {
    encoding = 'utf-8',
    skipEmpty = true,
    validate = true
  } = options;

  if (!existsSync(filePath)) {
    throw new Error(`JSONL file not found: ${filePath}`);
  }

  const content = readFileSync(filePath, encoding);
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (skipEmpty && !line) {
      continue;
    }

    try {
      const parsed = JSON.parse(line);
      yield parsed;
    } catch (error) {
      if (validate) {
        throw new Error(`Invalid JSON on line ${i + 1} in ${filePath}: ${error}`);
      }
      console.warn(`Skipping invalid JSON on line ${i + 1} in ${filePath}: ${line}`);
    }
  }
}

/**
 * Validate JSONL file format
 */
export function validateJSONL(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    readJSONL(filePath, { validate: true });
    return { valid: true, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { valid: false, errors };
  }
}

/**
 * Count lines in JSONL file (excluding empty lines)
 */
export function countJSONLLines(filePath: string): number {
  if (!existsSync(filePath)) {
    return 0;
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  return lines.filter(line => line.trim()).length;
}

/**
 * Scan directory for JSONL files and return their paths
 */
export function scanJsonlFiles(dirPath: string): string[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  const files: string[] = [];

  try {
    const entries = readdirSync(dirPath);

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      const stat = statSync(fullPath);

      if (stat.isFile() && entry.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dirPath}:`, error);
  }

  return files.sort(); // Sort for consistent order
}

/**
 * Load all JSONL files from a directory and combine them
 */
export function loadJsonlFromDirectory<T = any>(dirPath: string, options: JSONLReadOptions = {}): T[] {
  const files = scanJsonlFiles(dirPath);
  const allData: T[] = [];

  for (const filePath of files) {
    try {
      const data = readJSONL<T>(filePath, options);
      allData.push(...data);
      console.log(`📁 Loaded ${data.length} entries from ${filePath.split('/').pop()}`);
    } catch (error) {
      console.error(`❌ Error loading ${filePath}:`, error);
    }
  }

  return allData;
}