# Data Structure

This directory contains modular JSONL files organized by category for the Svelte 5 MCP server.

## 📁 Folder Structure

### `knowledge/` - Knowledge Base Entries
- `basic.jsonl` - Basic Svelte 5 concepts and getting started
- `runes.jsonl` - Runes ($state, $derived, $effect, $props, etc.)
- `advanced.jsonl` - Advanced patterns and techniques
- `performance.jsonl` - Performance optimization strategies
- `debugging.jsonl` - Debugging tools and techniques

### `patterns/` - Code Pattern Examples
- `components.jsonl` - Component patterns and best practices
- `state.jsonl` - State management patterns
- `effects.jsonl` - Effect patterns and side effects
- `ui.jsonl` - UI patterns and interactions
- `integration.jsonl` - Integration with external systems

## 🔄 How it Works

The MCP server automatically scans all `.jsonl` files in both directories and loads them into the search database. This modular approach allows for:

- Easy categorization of knowledge
- Better maintainability
- Simplified contributions
- Scalable knowledge base growth

## 📝 Adding New Content

1. Choose the appropriate category folder (`knowledge/` or `patterns/`)
2. Add entries to existing `.jsonl` files or create new category files
3. Use `--force` flag to resync the database with new content

## 📊 Current Stats

- **Knowledge**: ~70 entries across 5 categories
- **Patterns**: ~301 entries across 5 categories
- **Format**: JSONL (JSON Lines) for easy parsing and management