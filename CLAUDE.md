# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a specialized Model Context Protocol (MCP) server for Svelte 5 frontend development, adapted to use Bun instead of Node.js. It provides curated knowledge, code examples, and intelligent assistance for modern Svelte development with runes, snippets, and enhanced reactivity.

## Common Commands

### Development
```bash
# Start development server with watch mode
bun run dev

# Start the MCP server
bun run start

# Install dependencies
bun install

# Inspect the MCP server (for debugging)
bunx @modelcontextprotocol/inspector bun src/index.ts
```

### Publishing
```bash
# Publish to npm (no build step required - Bun runs TypeScript directly)
npm publish

# Test the published package locally
bunx @binsarjr/svelte5-mcp
```

### Testing
```bash
# Test the server manually
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | bun start

# Test via bunx
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | bunx @binsarjr/svelte5-mcp
```

## Architecture Overview

### Core Components

- **`src/index.ts`**: Main MCP server implementation with tool and prompt handlers
- **`src/Svelte5SearchDB.ts`**: SQLite-based search database with FTS5 full-text search capabilities
- **`src/data/svelte_5_knowledge.json`**: Curated Q&A knowledge base for Svelte 5 concepts
- **`src/data/svelte_5_patterns.json`**: Code examples and implementation patterns

### MCP Server Features

The server provides 5 main tools:
1. `search_knowledge` - Search the Svelte 5 knowledge base
2. `search_examples` - Search code patterns and examples
3. `generate_with_context` - Generate components using curated patterns
4. `audit_with_rules` - Audit code against Svelte 5 best practices
5. `explain_concept` - Get detailed concept explanations

Plus 4 smart prompts:
1. `generate-component` - Generate modern Svelte 5 components
2. `audit-svelte5-code` - Audit code for optimization
3. `explain-concept` - Detailed concept explanations
4. `search-patterns` - Find specific implementation patterns

### Database Architecture

Uses SQLite with FTS5 (Full-Text Search) for advanced search capabilities:
- **Tables**: `knowledge`, `examples`, `synonyms`
- **Virtual Tables**: `knowledge_fts`, `examples_fts` for full-text search
- **Triggers**: Automatic sync between main tables and FTS tables
- **Synonyms**: Svelte 5-specific term expansion for better search results

### Key Technologies

- **Runtime**: Bun (requires >= 1.0.0) - runs TypeScript directly without compilation
- **Database**: SQLite with FTS5 via `bun:sqlite`
- **Validation**: Zod schemas for input validation
- **MCP SDK**: `@modelcontextprotocol/sdk` for protocol implementation

### Deployment Options

**Option 1: Direct bunx usage (Recommended)**
```json
{
  "mcpServers": {
    "svelte5": {
      "command": "bunx",
      "args": ["@context-binsarjr/svelte5-mcp-server"],
      "env": {}
    }
  }
}
```

**Option 2: Local installation**
```json
{
  "mcpServers": {
    "svelte5": {
      "command": "bun",
      "args": ["/path/to/svelte5-mcp-bin/src/index.ts"],
      "env": {}
    }
  }
}
```

## Development Patterns

### Svelte 5 Focus
This server is specifically designed for Svelte 5 development patterns:
- Runes system (`$state`, `$derived`, `$effect`, `$props`, `$bindable`, `$inspect`)
- Snippets instead of slots (`{#snippet}`, `{@render}`)
- Modern event handling (`onclick` vs `on:click`)
- Enhanced reactivity and TypeScript integration

### Search Implementation
- **Query Expansion**: Automatic synonym expansion for Svelte 5 terms
- **Highlighted Results**: Search results include highlighted matches
- **Custom Scoring**: Advanced boosting for code-related terms
- **Relevance Ranking**: FTS5-based ranking for result ordering

### Data Management
- **Transactional Inserts**: Bulk data population using SQLite transactions
- **Automatic Indexing**: FTS triggers maintain search index consistency
- **JSON Validation**: Zod schemas ensure data integrity

## File Structure Guidelines

```
src/
├── index.ts              # Main MCP server (tool handlers, prompt handlers)
├── Svelte5SearchDB.ts    # Database layer with search functionality
└── data/
    ├── svelte_5_knowledge.json  # Q&A knowledge base
    └── svelte_5_patterns.json   # Code examples and patterns
```

## Configuration Notes

- Database is stored at `~/.config/binsarjr/svelte5-mcp/database.db` following XDG standard
- Uses Bun's native SQLite implementation (`bun:sqlite`)
- TypeScript configuration targets ES2022 with ESNext modules
- JSON imports use `with { type: "json" }` syntax for modern module resolution
- Config directory is consistent across all platforms for simplicity

## Data Format Requirements

### Knowledge Entries
```json
{
  "question": "How do you manage reactive state in Svelte 5?",
  "answer": "In Svelte 5, reactive state is managed using the $state rune..."
}
```

### Example Entries
```json
{
  "instruction": "Create a Svelte 5 component demonstrating $state",
  "input": "The rune allows you to create reactive state...",
  "output": "<script>\nlet count = $state(0);\n</script>..."
}
```