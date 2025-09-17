#!/usr/bin/env bun

/**
 * Script to convert JSON files to JSONL format
 * Usage: bun run src/utils/convert-to-jsonl.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeJSONL } from './jsonl.js';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface KnowledgeItem {
  question: string;
  answer: string;
}

interface ExampleItem {
  instruction: string;
  input: string;
  output: string;
}

function convertJSONToJSONL(inputPath: string, outputPath: string): void {
  console.log(`Converting ${inputPath} to ${outputPath}...`);

  if (!existsSync(inputPath)) {
    console.error(`❌ Input file not found: ${inputPath}`);
    return;
  }

  try {
    // Read the JSON file
    const jsonContent = readFileSync(inputPath, 'utf-8');
    const data = JSON.parse(jsonContent);

    // Validate that it's an array
    if (!Array.isArray(data)) {
      throw new Error('JSON file must contain an array');
    }

    // Write as JSONL
    writeJSONL(outputPath, data);

    console.log(`✅ Successfully converted ${data.length} items to ${outputPath}`);

    // Show file size comparison
    const originalSize = (jsonContent.length / 1024).toFixed(2);
    const newSize = (readFileSync(outputPath, 'utf-8').length / 1024).toFixed(2);
    console.log(`📊 Size: ${originalSize}KB → ${newSize}KB`);

  } catch (error) {
    console.error(`❌ Error converting ${inputPath}:`, error);
  }
}

function main() {
  const dataDir = join(__dirname, '..', 'data');

  // Convert knowledge file
  const knowledgeJsonPath = join(dataDir, 'svelte_5_knowledge.json');
  const knowledgeJsonlPath = join(dataDir, 'svelte_5_knowledge.jsonl');
  convertJSONToJSONL(knowledgeJsonPath, knowledgeJsonlPath);

  // Convert patterns file
  const patternsJsonPath = join(dataDir, 'svelte_5_patterns.json');
  const patternsJsonlPath = join(dataDir, 'svelte_5_patterns.jsonl');
  convertJSONToJSONL(patternsJsonPath, patternsJsonlPath);

  console.log('\n✨ Conversion complete! You can now update the code to use JSONL files.');
  console.log('\n📝 Next steps:');
  console.log('1. Update Svelte5SearchDB.ts to load JSONL files');
  console.log('2. Update index.ts to import JSONL files');
  console.log('3. Test the new implementation');
  console.log('4. Remove old JSON files when ready');
}

// Run the conversion
main();