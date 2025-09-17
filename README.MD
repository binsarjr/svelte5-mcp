# Svelte 5 MCP Server (Bun Version)

A specialized Model Context Protocol (MCP) server for Svelte 5 frontend development, providing curated knowledge, code examples, and intelligent assistance for modern Svelte development with runes, snippets, and enhanced reactivity.

> **Note**: This is a fork of [svelte5-mcp](https://github.com/StudentOfJS/svelte5-mcp) that has been adapted to use Bun instead of Node.js. This version is specifically optimized for Svelte 5 development with Bun as the runtime.

## Features

### 🔍 **Searchable Resources**
- **Knowledge Base**: Curated Q&A covering Svelte 5 concepts, runes, and best practices
- **Code Examples**: Searchable collection of Svelte 5 patterns and component implementations

### 🛠️ **Intelligent Tools**
- `search_knowledge` - Find explanations and concepts
- `search_examples` - Discover code patterns and implementations
- `generate_with_context` - Create components using curated patterns
- `audit_with_rules` - Review code against Svelte 5 best practices
- `explain_concept` - Get detailed explanations with examples

### 📝 **Smart Prompts**
- `generate-component` - Generate modern Svelte 5 components
- `audit-svelte5-code` - Audit code for optimization opportunities
- `explain-concept` - Detailed concept explanations
- `search-patterns` - Find specific implementation patterns

## Installation

### Option 1: Direct usage with bunx (Recommended)

Simply add to your Claude Desktop configuration - no installation required:

```json
{
  "mcpServers": {
    "svelte5": {
      "command": "bunx",
      "args": ["@binsarjr/svelte5-mcp"],
      "env": {}
    }
  }
}
```

### Option 2: Manual installation

```bash
# Clone and setup
git clone https://github.com/binsarjr/svelte5-mcp
cd svelte5-mcp-bin

# Install dependencies with Bun
bun install

# Start the server
bun start
```

## Project Structure

```
svelte5-mcp-bin/
├── src/
│   ├── index.ts          # Main MCP server implementation
│   ├── Svelte5SearchDB.ts # SQLite database with FTS5 search
│   └── data/
│       ├── svelte_5_knowledge.json    # Curated Q&A knowledge base
│       └── svelte_5_patterns.json     # Code examples and patterns
├── package.json
├── bun.lockb            # Bun lock file
├── tsconfig.json
└── README.md
```

## Usage with Claude Desktop

### Recommended: Using bunx (no installation required)

```json
{
  "mcpServers": {
    "svelte5": {
      "command": "bunx",
      "args": ["@binsarjr/svelte5-mcp"],
      "env": {}
    }
  }
}
```

### Alternative: Local installation

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

## Usage Examples

### 🔍 Search Knowledge
```
Tool: search_knowledge
Query: "runes reactivity"
```

Returns detailed explanations about Svelte 5 runes and the new reactivity system.

### 📚 Find Code Examples
```
Tool: search_examples  
Query: "counter component $state"
```

Returns working Svelte 5 counter implementations using the `$state` rune.

### 🏗️ Generate Components
```
Tool: generate_with_context
Description: "A todo list with add/remove functionality"
Features: ["$state", "snippets", "accessibility"]
```

Generates a complete todo component using modern Svelte 5 patterns with relevant examples from the knowledge base.

### 🔍 Audit Code
```
Tool: audit_with_rules
Code: "<script>let count = 0;</script><button on:click={() => count++}>{count}</button>"
Focus: "best-practices"
```

Analyzes code and suggests Svelte 5 improvements (e.g., using `$state` and modern event handling).

## Key Svelte 5 Concepts Covered

### 🎯 **Runes System**
- `$state` - Reactive state management
- `$derived` - Computed values and derived state
- `$effect` - Side effects and lifecycle
- `$props` - Component properties
- `$bindable` - Two-way data binding
- `$inspect` - Development debugging

### 🧩 **Modern Patterns**
- **Snippets** - Reusable template blocks (`{#snippet}`, `{@render}`)
- **Enhanced Reactivity** - Fine-grained updates
- **Event Handling** - Modern `onclick` vs legacy `on:click`
- **TypeScript Integration** - Better type inference
- **Accessibility** - Built-in a11y considerations

### 📈 **Migration Support**
- Svelte 4 → 5 migration patterns
- Legacy reactive statements (`$:`) → runes
- Slots → snippets conversion
- Event dispatcher → callback props

## Data Format

### Knowledge Base (`svelte_5_knowledge.json`)
```json
{
  "question": "How do you manage reactive state in Svelte 5?",
  "answer": "In Svelte 5, reactive state is managed using the $state rune..."
}
```

### Examples (`svelte_5_patterns.json`)
```json
{
  "instruction": "Create a Svelte 5 component demonstrating $state",
  "input": "The rune allows you to create reactive state...",
  "output": "<script>\nlet count = $state(0);\n</script>\n\n<button onclick={() => count++}>\n  clicks: {count}\n</button>"
}
```

## Configuration

### Database Location

The server stores its SQLite database following the XDG Base Directory specification:

- **All platforms**: `~/.config/binsarjr/svelte5-mcp/database.db`

This provides a consistent, organized location across all operating systems.

### Environment Variables

You can customize the database location using environment variables:

```json
{
  "mcpServers": {
    "svelte5": {
      "command": "bunx",
      "args": ["@binsarjr/svelte5-mcp"],
      "env": {
        "SVELTE5_MCP_CONFIG_DIR": "/custom/config/path",
        "SVELTE5_MCP_DB_PATH": "/custom/database.db"
      }
    }
  }
}
```

### Search Features

The server uses SQLite with FTS5 for advanced search capabilities:

- **Full-Text Search**: Utilizes SQLite's FTS5 extension for powerful and efficient searching across the knowledge base and code examples.
- **Tokenization**: Employs the `unicode61` tokenizer with a comprehensive set of separators for robust indexing of terms.
- **Synonym Expansion**: Enhances search recall by automatically expanding query terms with predefined Svelte 5-specific synonyms (e.g., '$state' also matches 'reactive state').
- **Result Highlighting**: Search results include highlighted matches within relevant fields (e.g., question, answer, instruction) using FTS5's `highlight()` function.
- **Relevance Ranking**: Results are ordered by relevance based on FTS5's internal ranking algorithm.
- **Advanced Boosting**: Offers capabilities for custom scoring and boosting to fine-tune search results, such as prioritizing matches in question fields or code content.

## Development
=

### Data Processing
```bash
bun process-attached-data.js    # Process curated knowledge
bun setup-data.js              # Create sample data
```

### Testing
The server provides comprehensive logging and error handling:

```bash
# Test the server
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | bun start
```

## Contributing

### Adding Knowledge
1. Add entries to `data/svelte_5_knowledge.json`
2. Format: `{"question": "...", "answer": "..."}`
3. Focus on Svelte 5 specific features and best practices

### Adding Examples  
1. Add entries to `data/svelte_5_patterns.json`
2. Format: `{"instruction": "...", "input": "...", "output": "..."}`
3. Include complete, working Svelte 5 code examples

### Search Optimization
- Use descriptive, searchable keywords in questions and instructions
- Include alternative phrasings for common concepts
- Tag examples with relevant feature names (`$state`, `snippets`, etc.)

## Advanced Usage

### Custom Search Queries
The search tools support sophisticated queries:

```typescript
// Search for state management patterns
search_examples("$state reactive updates")

// Find accessibility guidance
search_knowledge("a11y accessibility screen reader")

// Discover migration patterns
search_examples("svelte 4 migration runes")
```

### Prompt Chaining
Use prompts in sequence for complex workflows:

1. `search-patterns` - Find relevant patterns
2. `generate-component` - Create based on patterns
3. `audit-svelte5-code` - Review and optimize

### Integration Tips
- **Claude Desktop**: Best for interactive development
- **API Integration**: Use programmatically for code generation
- **CI/CD**: Audit code in automated workflows
- **Documentation**: Generate examples for style guides

## Troubleshooting

### Common Issues

**"No results found"**
- Check search terms are relevant to Svelte 5
- Try broader queries first, then narrow down
- Ensure data files are properly formatted json

**"Tool not found"**
- Check MCP client configuration
- Review server logs for startup errors

**"Invalid data format"**
- Validate JSON files
- Check for trailing commas or syntax errors

**Database/Config Issues**
- Check if config directory is writable
- Verify database permissions in the config folder
- Use `SVELTE5_MCP_DB_PATH` environment variable for custom locations
- Check logs for database initialization messages

### Debugging
```bash
# Enable debug logging
DEBUG=* bun start

# Test database location
bunx @binsarjr/svelte5-mcp  # Watch for config path logs

# Check config directory (all platforms)
ls -la ~/.config/binsarjr/svelte5-mcp/
```

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Built with [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- Validation with [Zod](https://zod.dev/)
- Curated Svelte 5 knowledge from official documentation and community best practices