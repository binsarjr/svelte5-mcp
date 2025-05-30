#!/bin/bash

# Svelte 5 MCP Server Setup Script
# Run this after cloning the repository

set -e

echo "🚀 Setting up Svelte 5 MCP Server..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p src data dist

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Move the main server code to src/ if it's in the root
if [ -f "index.ts" ]; then
    mv index.ts src/index.ts
    echo "✅ Moved main server file to src/"
fi

# Process the curated data
echo "📊 Processing Svelte 5 knowledge and examples..."
if [ -f "process-attached-data.js" ]; then
    node process-attached-data.js
else
    echo "⚠️  Data processing script not found, creating sample data..."
    node setup-data.js 2>/dev/null || echo "⚠️  No sample data script found"
fi

# Build the TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Check if build was successful
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed. Please check for TypeScript errors."
    exit 1
fi

echo "✅ Build successful!"

# Test the server
echo "🧪 Testing server startup..."
timeout 5s npm start > /dev/null 2>&1 || true

# Create environment file
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env 2>/dev/null || echo "⚠️  No .env.example found"
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Configure Claude Desktop (see claude-config-example.json)"
echo "   2. Start the server: npm start"
echo "   3. Test with Claude Desktop or MCP client"
echo ""
echo "📖 Available tools:"
echo "   • search_knowledge - Find Svelte 5 concepts and explanations"
echo "   • search_examples - Discover code patterns and examples" 
echo "   • generate_with_context - Create components with curated patterns"
echo "   • audit_with_rules - Review code against best practices"
echo "   • explain_concept - Get detailed concept explanations"
echo ""
echo "📚 Resources:"
echo "   • Knowledge base: $(wc -l < data/svelte_5_knowledge.jsonl 2>/dev/null || echo "0") items"
echo "   • Code examples: $(wc -l < data/svelte_5_patterns.jsonl 2>/dev/null || echo "0") items"
echo ""

# Get absolute path for Claude config
CURRENT_DIR=$(pwd)
echo "🔗 Claude Desktop config path:"
echo "   \"command\": \"node\","
echo "   \"args\": [\"$CURRENT_DIR/dist/index.js\"]"
echo ""
echo "Happy coding with Svelte 5! 🎊"