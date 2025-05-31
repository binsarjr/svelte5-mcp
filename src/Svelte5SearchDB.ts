import Database from 'better-sqlite3';

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
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Create tables with FTS5 for advanced text search
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS examples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instruction TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    const insertSynonym = this.db.prepare(`
      INSERT OR REPLACE INTO synonyms (term, synonyms) VALUES (?, ?)
    `);

    for (const { term, synonyms } of sveltesynonyms) {
      insertSynonym.run(term, JSON.stringify(synonyms));
    }
  }

  populateData(knowledge: KnowledgeItem[], examples: ExampleItem[]) {
    const insertKnowledge = this.db.prepare(`
      INSERT INTO knowledge (question, answer) VALUES (?, ?)
    `);

    const insertExample = this.db.prepare(`
      INSERT INTO examples (instruction, input, output) VALUES (?, ?, ?)
    `);

    const insertMany = this.db.transaction((knowledgeItems: KnowledgeItem[], exampleItems: ExampleItem[]) => {
      for (const item of knowledgeItems) {
        insertKnowledge.run(item.question, item.answer);
      }
      for (const item of exampleItems) {
        insertExample.run(item.instruction, item.input, item.output);
      }
    });

    insertMany(knowledge, examples);
  }

  private expandQuery(query: string): string {
    // Get synonyms for terms in the query
    const synonymsQuery = this.db.prepare(`
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

  searchKnowledge(query: string, limit: number = 5) {
    const expandedQuery = this.expandQuery(query);
    
    const searchQuery = this.db.prepare(`
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
        answer: row.answer,
        highlighted_question: row.highlighted_question,
        highlighted_answer: row.highlighted_answer,
        relevance_score: -row.rank, // FTS5 rank is negative, convert to positive
      }))
    };
  }

  searchExamples(query: string, limit: number = 5) {
    const expandedQuery = this.expandQuery(query);
    
    const searchQuery = this.db.prepare(`
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
        instruction: row.instruction,
        input: row.input,
        output: row.output,
        highlighted_instruction: row.highlighted_instruction,
        highlighted_input: row.highlighted_input,
        highlighted_output: row.highlighted_output,
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
      const searchQuery = this.db.prepare(`
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
      const searchQuery = this.db.prepare(`
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
