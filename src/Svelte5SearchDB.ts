import { Database } from 'bun:sqlite'
import { getDatabasePath } from './utils/config.js'
import { createHash } from 'crypto'
import packageJson from '../package.json' with { type: 'json' }
import { readJSONL, loadJsonlFromDirectory } from './utils/jsonl.js'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

interface KnowledgeItem {
  id?: number;
  question: string;
  answer: string;
}

interface ExampleItem {
  id?: number;
  instruction: string;
  input: string;
  output: string;
}

interface SynonymRow {
  term: string;
  synonyms: string;
}

interface KnowledgeSearchRow {
  id: number;
  question: string;
  answer: string;
  rank: number;
  highlighted_question: string;
  highlighted_answer: string;
}

interface ExampleSearchRow {
  id: number;
  instruction: string;
  input: string;
  output: string;
  rank: number;
  highlighted_instruction: string;
  highlighted_input: string;
  highlighted_output: string;
}

interface CustomScoreRow {
  id: number;
  question?: string;
  answer?: string;
  instruction?: string;
  input?: string;
  output?: string;
  custom_score: number;
}

export class Svelte5SearchDB {
  private db: Database;

  constructor(dbPath?: string) {
    // Use config-based path if no path provided, fallback to memory
    const finalDbPath = dbPath || getDatabasePath();
    this.db = new Database(finalDbPath);
    this.initializeDatabase();

    // Log database location for debugging
    if (finalDbPath !== ':memory:') {
      console.log(`Svelte5 MCP: Database initialized at ${finalDbPath}`);
    }
  }

  private initializeDatabase() {
    // Create tables with FTS5 for advanced text search
    this.db.run(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL UNIQUE,
        answer TEXT NOT NULL,
        content_hash TEXT,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instruction TEXT NOT NULL UNIQUE,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        content_hash TEXT,
        version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- FTS5 virtual tables for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        question, answer,
        content='knowledge',
        content_rowid='id',
        tokenize="unicode61 separators ' !""#$%&''()*+,-./:;<=>?@[\]^_\`{|}~'"
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS examples_fts USING fts5(
        instruction, input, output,
        content='examples',
        content_rowid='id',
        tokenize="unicode61 separators ' !""#$%&''()*+,-./:;<=>?@[\]^_\`{|}~'"
      );

      -- Create synonyms table for Svelte 5 specific terms
      CREATE TABLE IF NOT EXISTS synonyms (
        term TEXT PRIMARY KEY,
        synonyms TEXT NOT NULL -- JSON array of synonyms
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
        INSERT INTO knowledge_fts(rowid, question, answer)
        VALUES (new.id, new.question, new.answer);
      END;

      CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, question, answer)
        VALUES('delete', old.id, old.question, old.answer);
      END;

      CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
        INSERT INTO knowledge_fts(knowledge_fts, rowid, question, answer)
        VALUES('delete', old.id, old.question, old.answer);
        INSERT INTO knowledge_fts(rowid, question, answer)
        VALUES (new.id, new.question, new.answer);
      END;

      CREATE TRIGGER IF NOT EXISTS examples_ai AFTER INSERT ON examples BEGIN
        INSERT INTO examples_fts(rowid, instruction, input, output)
        VALUES (new.id, new.instruction, new.input, new.output);
      END;

      CREATE TRIGGER IF NOT EXISTS examples_ad AFTER DELETE ON examples BEGIN
        INSERT INTO examples_fts(examples_fts, rowid, instruction, input, output)
        VALUES('delete', old.id, old.instruction, old.input, old.output);
      END;

      CREATE TRIGGER IF NOT EXISTS examples_au AFTER UPDATE ON examples BEGIN
        INSERT INTO examples_fts(examples_fts, rowid, instruction, input, output)
        VALUES('delete', old.id, old.instruction, old.input, old.output);
        INSERT INTO examples_fts(rowid, instruction, input, output)
        VALUES (new.id, new.instruction, new.input, new.output);
      END;
    `);

    this.setupSynonyms();
  }

  private setupSynonyms() {
    const sveltesynonyms = [
      { term: '$state', synonyms: ['state', 'reactive state', 'reactivity', 'reactive variable'] },
      { term: '$derived', synonyms: ['derived', 'computed', 'derived state', 'computed value'] },
      { term: '$effect', synonyms: ['effect', 'side effect', 'side-effect', 'lifecycle', 'cleanup'] },
      { term: '$props', synonyms: ['props', 'properties', 'component props', 'export let'] },
      { term: 'snippets', synonyms: ['snippet', 'slot', 'content projection', 'render', '@render'] },
      { term: 'runes', synonyms: ['rune', '$state', '$derived', '$effect', '$props', 'svelte 5'] },
      { term: 'migrate', synonyms: ['migration', 'upgrade', 'convert', 'transition', 'svelte 4 to 5'] },
      { term: 'onclick', synonyms: ['on:click', 'event handler', 'event attribute', 'click handler'] },
      { term: 'bind:', synonyms: ['binding', 'two-way binding', 'bind directive'] },
      { term: 'use:', synonyms: ['action', 'use directive', 'action function'] }
    ];

    const insertSynonym = this.db.query(`
      INSERT OR REPLACE INTO synonyms (term, synonyms) VALUES (?, ?)
    `);

    for (const { term, synonyms } of sveltesynonyms) {
      insertSynonym.run(term, JSON.stringify(synonyms));
    }
  }

  private generateContentHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  private isDatabaseInitialized(): boolean {
    try {
      const result = this.db.query(`
        SELECT COUNT(*) as count
        FROM sqlite_master
        WHERE type='table' AND name IN ('knowledge', 'examples', 'metadata')
      `).get() as { count: number };

      // Check if all required tables exist
      return result.count >= 3;
    } catch {
      return false;
    }
  }

  private setMetadata(key: string, value: string) {
    const query = this.db.query(`
      INSERT INTO metadata (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);
    query.run(key, value);
  }

  private getMetadata(key: string): string | null {
    try {
      const result = this.db.query(`
        SELECT value FROM metadata WHERE key = ?
      `).get(key) as { value: string } | null;
      return result?.value || null;
    } catch {
      return null;
    }
  }

  populateData(knowledge: KnowledgeItem[], examples: ExampleItem[]) {
    // Check if this is first initialization or update
    const isFirstRun = !this.isDatabaseInitialized() ||
                       (this.db.query("SELECT COUNT(*) as count FROM knowledge").get() as { count: number }).count === 0;

    if (isFirstRun) {
      console.log('Svelte5 MCP: First run - initializing database with knowledge base');
    } else {
      // Check version
      const currentDbVersion = this.getMetadata('db_version');
      console.log(`Svelte5 MCP: Database exists (v${currentDbVersion}) - checking for updates to v${packageJson.version}`);

      if (currentDbVersion === packageJson.version) {
        console.log('Svelte5 MCP: Database is up to date, skipping population');
        return; // Skip if same version
      }
    }

    // Prepare UPSERT queries
    const upsertKnowledge = this.db.query(`
      INSERT INTO knowledge (question, answer, content_hash, version)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(question) DO UPDATE SET
        answer = excluded.answer,
        content_hash = excluded.content_hash,
        version = excluded.version,
        updated_at = CURRENT_TIMESTAMP
      WHERE content_hash != excluded.content_hash OR content_hash IS NULL
    `);

    const upsertExample = this.db.query(`
      INSERT INTO examples (instruction, input, output, content_hash, version)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(instruction) DO UPDATE SET
        input = excluded.input,
        output = excluded.output,
        content_hash = excluded.content_hash,
        version = excluded.version,
        updated_at = CURRENT_TIMESTAMP
      WHERE content_hash != excluded.content_hash OR content_hash IS NULL
    `);

    // Use transaction for better performance
    this.db.transaction(() => {
      let knowledgeUpdated = 0;
      let knowledgeInserted = 0;

      for (const item of knowledge) {
        const contentHash = this.generateContentHash(item.question + item.answer);
        const changes = upsertKnowledge.run(
          item.question,
          item.answer,
          contentHash,
          1  // version
        );

        // Check if it was an update or insert
        if (changes.changes > 0) {
          if (changes.lastInsertRowid) {
            knowledgeInserted++;
          } else {
            knowledgeUpdated++;
          }
        }
      }

      let examplesUpdated = 0;
      let examplesInserted = 0;

      for (const item of examples) {
        const contentHash = this.generateContentHash(item.instruction + item.input + item.output);
        const changes = upsertExample.run(
          item.instruction,
          item.input,
          item.output,
          contentHash,
          1  // version
        );

        if (changes.changes > 0) {
          if (changes.lastInsertRowid) {
            examplesInserted++;
          } else {
            examplesUpdated++;
          }
        }
      }

      // Update metadata
      this.setMetadata('last_sync', new Date().toISOString());
      this.setMetadata('db_version', packageJson.version);
      this.setMetadata('package_name', packageJson.name);
      this.setMetadata('knowledge_count', knowledge.length.toString());
      this.setMetadata('examples_count', examples.length.toString());

      if (knowledgeInserted > 0 || examplesInserted > 0) {
        console.log(`Svelte5 MCP: Added ${knowledgeInserted} knowledge items, ${examplesInserted} examples`);
      }
      if (knowledgeUpdated > 0 || examplesUpdated > 0) {
        console.log(`Svelte5 MCP: Updated ${knowledgeUpdated} knowledge items, ${examplesUpdated} examples`);
      }
    })();
  }

  /**
   * Load data from JSONL folders (new modular approach)
   */
  populateFromFolders(dataDir: string, forceResync: boolean = false) {
    try {
      // Check if we need to resync or if database is empty
      const knowledgeCount = this.db.query('SELECT COUNT(*) as count FROM knowledge').get() as { count: number };
      const examplesCount = this.db.query('SELECT COUNT(*) as count FROM examples').get() as { count: number };

      if (!forceResync && knowledgeCount.count > 0 && examplesCount.count > 0) {
        console.log(`📚 Database already populated (${knowledgeCount.count} knowledge, ${examplesCount.count} examples). Use --force to resync.`);
        return;
      }

      if (forceResync) {
        console.log('🔄 Force resync: Clearing existing data...');
        this.db.query('DELETE FROM knowledge').run();
        this.db.query('DELETE FROM examples').run();
        this.db.query('DELETE FROM synonyms').run();
        console.log('✅ Existing data cleared');
      }

      // Load knowledge data from knowledge/ folder
      const knowledgeDir = join(dataDir, 'knowledge');
      const knowledge = loadJsonlFromDirectory<KnowledgeItem>(knowledgeDir);
      console.log(`📖 Total knowledge loaded: ${knowledge.length} items`);

      // Load examples data from patterns/ folder
      const patternsDir = join(dataDir, 'patterns');
      const examples = loadJsonlFromDirectory<ExampleItem>(patternsDir);
      console.log(`💻 Total patterns loaded: ${examples.length} items`);

      // Populate database
      this.populateData(knowledge, examples);
      console.log('✅ Database populated successfully from folders');
    } catch (error) {
      console.error('❌ Error loading data from folders:', error);
      throw error;
    }
  }

  /**
   * Load data from JSONL files (legacy method for backward compatibility)
   */
  populateFromJSONL(knowledgePath: string, examplesPath: string, forceResync: boolean = false) {
    try {
      // Check if we need to resync or if database is empty
      const knowledgeCount = this.db.query('SELECT COUNT(*) as count FROM knowledge').get() as { count: number };
      const examplesCount = this.db.query('SELECT COUNT(*) as count FROM examples').get() as { count: number };

      if (!forceResync && knowledgeCount.count > 0 && examplesCount.count > 0) {
        console.log(`📚 Database already populated (${knowledgeCount.count} knowledge, ${examplesCount.count} examples). Use --force to resync.`);
        return;
      }

      if (forceResync) {
        console.log('🔄 Force resync: Clearing existing data...');
        this.db.query('DELETE FROM knowledge').run();
        this.db.query('DELETE FROM examples').run();
        this.db.query('DELETE FROM synonyms').run();
        console.log('✅ Existing data cleared');
      }

      // Load knowledge data
      const knowledge = readJSONL<KnowledgeItem>(knowledgePath);
      console.log(`📖 Loaded ${knowledge.length} knowledge items from JSONL`);

      // Load examples data
      const examples = readJSONL<ExampleItem>(examplesPath);
      console.log(`💻 Loaded ${examples.length} examples from JSONL`);

      // Populate database
      this.populateData(knowledge, examples);
      console.log('✅ Database populated successfully');
    } catch (error) {
      console.error('❌ Error loading JSONL data:', error);
      throw error;
    }
  }

  /**
   * Truncate text to specified length with ellipsis
   */
  private truncateText(text: string, maxLength: number = 500): string {
    if (text.length <= maxLength) return text;

    // Try to cut at a word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    const cutPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;

    return text.substring(0, cutPoint) + '...';
  }

  private expandQuery(query: string): string {
    // Get synonyms for terms in the query
    const synonymsQuery = this.db.query(`
      SELECT term, synonyms FROM synonyms
      WHERE term LIKE '%' || ? || '%' OR ? LIKE '%' || term || '%'
    `);

    const words = query.toLowerCase().split(/\s+/);
    const expandedTerms = new Set([query]);

    for (const word of words) {
      const synonymRows = synonymsQuery.all(word, word) as SynonymRow[];
      for (const row of synonymRows) {
        const synonyms = JSON.parse(row.synonyms);
        synonyms.forEach((synonym: string) => expandedTerms.add(synonym));

        // Add variations of the original query with synonyms
        synonyms.forEach((synonym: string) => {
          expandedTerms.add(query.replace(new RegExp(word, 'gi'), synonym));
        });
      }
    }

    // Create FTS5 query with OR operators
    return Array.from(expandedTerms)
      .map(term => `"${term.replace(/"/g, '""')}"`)
      .join(' OR ');
  }

  searchKnowledge(query: string, limit: number = 3, maxAnswerLength: number = 800) {
    const expandedQuery = this.expandQuery(query);

    const searchQuery = this.db.query(`
      SELECT k.*,
             knowledge_fts.rank,
             highlight(knowledge_fts, 0, '<mark>', '</mark>') as highlighted_question,
             highlight(knowledge_fts, 1, '<mark>', '</mark>') as highlighted_answer
      FROM knowledge_fts
      JOIN knowledge k ON k.id = knowledge_fts.rowid
      WHERE knowledge_fts MATCH ?
      ORDER BY knowledge_fts.rank
      LIMIT ?
    `);

    const results = searchQuery.all(expandedQuery, limit) as KnowledgeSearchRow[];

    return {
      query,
      expanded_query: expandedQuery,
      total_results: results.length,
      results: results.map(row => ({
        id: row.id,
        question: row.question,
        answer: this.truncateText(row.answer, maxAnswerLength),
        highlighted_question: row.highlighted_question,
        highlighted_answer: this.truncateText(row.highlighted_answer, maxAnswerLength),
        relevance_score: -row.rank, // FTS5 rank is negative, convert to positive
      }))
    };
  }

  searchExamples(query: string, limit: number = 3, maxContentLength: number = 400) {
    const expandedQuery = this.expandQuery(query);

    const searchQuery = this.db.query(`
      SELECT e.*,
             examples_fts.rank,
             highlight(examples_fts, 0, '<mark>', '</mark>') as highlighted_instruction,
             highlight(examples_fts, 1, '<mark>', '</mark>') as highlighted_input,
             highlight(examples_fts, 2, '<mark>', '</mark>') as highlighted_output
      FROM examples_fts
      JOIN examples e ON e.id = examples_fts.rowid
      WHERE examples_fts MATCH ?
      ORDER BY examples_fts.rank
      LIMIT ?
    `);

    const results = searchQuery.all(expandedQuery, limit) as ExampleSearchRow[];

    return {
      query,
      expanded_query: expandedQuery,
      total_results: results.length,
      results: results.map(row => ({
        id: row.id,
        instruction: this.truncateText(row.instruction, maxContentLength),
        input: this.truncateText(row.input, maxContentLength),
        output: this.truncateText(row.output, maxContentLength),
        highlighted_instruction: this.truncateText(row.highlighted_instruction, maxContentLength),
        highlighted_input: this.truncateText(row.highlighted_input, maxContentLength),
        highlighted_output: this.truncateText(row.highlighted_output, maxContentLength),
        relevance_score: -row.rank,
      }))
    };
  }

  // Advanced search with custom scoring
  searchWithBoosts(query: string, type: 'knowledge' | 'examples', options: {
    limit?: number;
    questionBoost?: number; // for knowledge
    instructionBoost?: number; // for examples
    codeBoost?: number; // boost for code-related terms
  } = {}) {
    const { limit = 5, questionBoost = 2.0, instructionBoost = 1.5, codeBoost = 1.5 } = options;
    const expandedQuery = this.expandQuery(query);

    if (type === 'knowledge') {
      // Custom scoring for knowledge with question boost
      const searchQuery = this.db.query(`
        SELECT k.*,
               (knowledge_fts.rank *
                CASE WHEN knowledge_fts.rank < -10 THEN ? ELSE 1.0 END +
                CASE WHEN k.question LIKE '%$%' OR k.answer LIKE '%$%' THEN ? ELSE 1.0 END
               ) as custom_score
        FROM knowledge_fts
        JOIN knowledge k ON k.id = knowledge_fts.rowid
        WHERE knowledge_fts MATCH ?
        ORDER BY custom_score
        LIMIT ?
      `);

      return searchQuery.all(questionBoost, codeBoost, expandedQuery, limit) as CustomScoreRow[];
    } else {
      // Custom scoring for examples with instruction boost and code detection
      const searchQuery = this.db.query(`
        SELECT e.*,
               (examples_fts.rank *
                CASE WHEN examples_fts.rank < -10 THEN ? ELSE 1.0 END +
                CASE WHEN e.output LIKE '%$%' OR e.output LIKE '%{%' THEN ? ELSE 1.0 END
               ) as custom_score
        FROM examples_fts
        JOIN examples e ON e.id = examples_fts.rowid
        WHERE examples_fts MATCH ?
        ORDER BY custom_score
        LIMIT ?
      `);

      return searchQuery.all(instructionBoost, codeBoost, expandedQuery, limit) as CustomScoreRow[];
    }
  }

  close() {
    this.db.close();
  }
}
