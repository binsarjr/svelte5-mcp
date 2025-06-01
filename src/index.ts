import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import knowledgeJson from "./data/svelte_5_knowledge.json" with { type: "json" }
import examplesJson from "./data/svelte_5_patterns.json" with { type: "json" }
import {Svelte5SearchDB} from "./Svelte5SearchDB.js";

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Zod schemas for validation
const SearchQuerySchema = z.object({
  query: z.string().describe("Search query"),
  limit: z.number().optional().default(5).describe("Maximum number of results"),
});

const GenerateComponentSchema = z.object({
  description: z.string().describe("Description of the component to generate"),
  features: z.array(z.string()).optional().describe("Specific features to include"),
  complexity: z.enum(["simple", "moderate", "complex"]).optional().default("moderate"),
});

const AuditCodeSchema = z.object({
  code: z.string().describe("Svelte 5 code to audit"),
  focus: z.enum(["performance", "accessibility", "best-practices", "all"]).optional().default("all"),
});

const ExplainConceptSchema = z.object({
  concept: z.string().describe("Svelte 5 concept to explain"),
  detail_level: z.enum(["basic", "intermediate", "advanced"]).optional().default("intermediate"),
});

// Type definitions
interface KnowledgeItem {
  question: string;
  answer: string;
}

interface ExampleItem {
  instruction: string;
  input: string;
  output: string;
}

const knowledgeContent: KnowledgeItem[] = knowledgeJson
const examplesContent: ExampleItem[] = examplesJson

class Svelte5MCPServer {
  private server: Server;
  private searchDB?: Svelte5SearchDB;

  constructor() {
    this.server = new Server(
      {
        name: "svelte5-mcp-server",
        version: "1.0.0",
        description: "MCP server for Svelte 5 frontend development with curated knowledge and examples",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    );
    this.setupHandlers();
    // Create database in the MCP server's directory, not the current working directory
    const dbPath = join(__dirname, '..', 'svelte5-knowledge.db');
    this.searchDB = new Svelte5SearchDB(dbPath);
    this.searchDB.populateData(knowledgeContent, examplesContent);
  }



  private setupHandlers() {

    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "svelte5://knowledge",
          mimeType: "application/json",
          name: "Svelte 5 Knowledge Base",
          description: "Curated Q&A knowledge base for Svelte 5 concepts, features, and best practices",
        },
        {
          uri: "svelte5://examples",
          mimeType: "application/json", 
          name: "Svelte 5 Code Examples",
          description: "Searchable collection of Svelte 5 code patterns and component examples",
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      switch (uri) {
        case "svelte5://knowledge":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(knowledgeContent, null, 2),
              },
            ],
          };

        case "svelte5://examples":
          return {
            contents: [
              {
                uri,
                mimeType: "application/json", 
                text: JSON.stringify(examplesContent, null, 2),
              },
            ],
          };

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_knowledge",
          description: "Search the Svelte 5 knowledge base for concepts, explanations, and Q&A",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query"
              },
              limit: {
                type: "number",
                default: 5,
                description: "Maximum number of results"
              }
            },
            required: ["query"]
          },
        },
        {
          name: "search_examples",
          description: "Search Svelte 5 code examples and patterns",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query"
              },
              limit: {
                type: "number",
                default: 5,
                description: "Maximum number of results"
              }
            },
            required: ["query"]
          },
        },
        {
          name: "generate_with_context",
          description: "Generate Svelte 5 components using knowledge context",
          inputSchema: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "Description of the component to generate"
              },
              features: {
                type: "array",
                items: { type: "string" },
                description: "Specific features to include"
              },
              complexity: {
                type: "string",
                enum: ["simple", "moderate", "complex"],
                default: "moderate",
                description: "Complexity level"
              }
            },
            required: ["description"]
          },
        },
        {
          name: "audit_with_rules",
          description: "Audit Svelte 5 code against best practices and patterns",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "Svelte 5 code to audit"
              },
              focus: {
                type: "string",
                enum: ["performance", "accessibility", "best-practices", "all"],
                default: "all",
                description: "Focus area"
              }
            },
            required: ["code"]
          },
        },
        {
          name: "explain_concept",
          description: "Get detailed explanations of Svelte 5 concepts with examples",
          inputSchema: {
            type: "object",
            properties: {
              concept: {
                type: "string",
                description: "Svelte 5 concept to explain"
              },
              detail_level: {
                type: "string",
                enum: ["basic", "intermediate", "advanced"],
                default: "intermediate",
                description: "Detail level"
              }
            },
            required: ["concept"]
          },
        }
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "search_knowledge":
          return this.searchKnowledge(args);
        case "search_examples":
          return this.searchExamples(args);
        case "generate_with_context":
          return this.generateWithContext(args);
        case "audit_with_rules":
          return this.auditWithRules(args);
        case "explain_concept":
          return this.explainConcept(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    this.server.setRequestHandler(ListPromptsRequestSchema, async () => ({
      prompts: [
        {
          name: "generate-component",
          description: "Generate a Svelte 5 component with modern patterns",
          arguments: [
            {
              name: "description",
              description: "Description of the component to create",
              required: true,
            },
            {
              name: "features",
              description: "Comma-separated list of features to include",
              required: false,
            },
          ]
        },
        {
          name: "audit-svelte5-code",
          description: "Audit Svelte 5 code for best practices and optimization opportunities",
          arguments: [
            {
              name: "code",
              description: "Svelte 5 code to audit",
              required: true,
            },
            {
              name: "focus",
              description: "Focus area: performance, accessibility, best-practices, or all",
              required: false,
            },
          ]
        },
        {
          name: "explain-concept",
          description: "Explain Svelte 5 concepts with detailed examples and comparisons",
          arguments: [
            {
              name: "concept",
              description: "Svelte 5 concept to explain (e.g., 'runes', '$state', 'snippets')",
              required: true,
            },
            {
              name: "level",
              description: "Detail level: basic, intermediate, or advanced",
              required: false,
            },
          ]
        },
        {
          name: "search-patterns",
          description: "Search for specific Svelte 5 patterns and implementations",
          arguments: [
            {
              name: "pattern",
              description: "Pattern or feature to search for",
              required: true,
            },
            {
              name: "context",
              description: "Additional context or requirements",
              required: false,
            },
          ]
        },
      ],
    }));

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "generate-component":
          return this.getGenerateComponentPrompt(args);
        case "audit-svelte5-code":
          return this.getAuditCodePrompt(args);
        case "explain-concept":
          return this.getExplainConceptPrompt(args);
        case "search-patterns":
          return this.getSearchPatternsPrompt(args);
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });
  }

  private async searchKnowledge(args: any) {
    const { query, limit } = SearchQuerySchema.parse(args);
    const results = this.searchDB?.searchKnowledge(query, limit);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2),
      }],
    };
  }

  private async searchExamples(args: any) {
    const { query, limit } = SearchQuerySchema.parse(args);
    const results = this.searchDB?.searchExamples(query, limit);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(results, null, 2),
      }],
    };
  }

    private async generateWithContext(args: any) {
    const { description, features, complexity } = GenerateComponentSchema.parse(args);
    
    // Search for relevant patterns
    const patternResults = this.searchDB?.searchExamples(description, 3);
    const knowledgeResults = this.searchDB?.searchKnowledge(description, 2);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            request: { description, features, complexity },
            relevant_patterns: patternResults?.results?.map(r => ({
              instruction: r.instruction,
              output: r.output,
              relevance: r.relevance_score,
            })),
            relevant_knowledge: knowledgeResults?.results?.map(r => ({
              question: r.question,
              answer: r.answer,
              relevance: r.relevance_score,
            })),
            generation_guidance: {
              use_runes: true,
              prefer_snippets_over_slots: true,
              include_typescript: true,
              focus_accessibility: true,
              modern_patterns_only: true,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async auditWithRules(args: any) {
    const { code, focus } = AuditCodeSchema.parse(args);
    
    // Find relevant best practices
    const focusQueries = {
      performance: "performance optimization derived state effect",
      accessibility: "accessibility a11y semantic",
      "best-practices": "best practices runes modern patterns",
      all: "best practices performance accessibility patterns",
    };

    const relevantKnowledge = this.searchDB?.searchKnowledge(focusQueries[focus], 4);;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            code_audit: {
              focus_area: focus,
              code_length: code.length,
              relevant_guidelines: relevantKnowledge?.results.map(r => ({
                guideline: r.question,
                explanation: r.answer,
                relevance: r.relevance_score,
              })),
              audit_checklist: {
                uses_runes: code.includes("$state") || code.includes("$derived") || code.includes("$effect"),
                uses_modern_events: code.includes("onclick") && !code.includes("on:click"),
                uses_snippets: code.includes("{#snippet") || code.includes("{@render"),
                has_typescript: code.includes("lang=\"ts\"") || code.includes(": "),
                accessibility_attributes: code.includes("aria-") || code.includes("role="),
              },
            },
          }, null, 2),
        },
      ],
    };
  }

  private async explainConcept(args: any) {
    const { concept, detail_level } = ExplainConceptSchema.parse(args);
    
    const conceptResults = this.searchDB?.searchKnowledge(concept, 3);
    const exampleResults = this.searchDB?.searchExamples(concept, 2);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            concept_explanation: {
              concept,
              detail_level,
              explanations: conceptResults?.results?.map(item => ({
                question: item.question,
                answer: item.answer,
                relevance: item.relevance_score,
              })),
              code_examples: exampleResults?.results?.map(item => ({
                scenario: item.input,
                implementation: item.output,
                relevance: item.relevance_score,
              })),
            },
          }, null, 2),
        },
      ],
    };
  }

  private async getGenerateComponentPrompt(args: any) {
    const description = args?.description || "[component description]";
    const features = args?.features || "";

    return {
      description: "Generate a modern Svelte 5 component with best practices",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Create a Svelte 5 component: ${description}

${features ? `Features to include: ${features}` : ""}

Requirements:
- Use Svelte 5 runes ($state, $derived, $effect, $props)
- Use snippets instead of slots where appropriate
- Include TypeScript types
- Follow accessibility best practices
- Use modern event handling (onclick vs on:click)
- Include proper error handling
- Add meaningful comments explaining Svelte 5 features used

Provide a complete, working component with explanation of the Svelte 5 patterns used.`,
          },
        },
      ],
    };
  }

  private async getAuditCodePrompt(args: any) {
    const code = args?.code || "[paste your Svelte code here]";
    const focus = args?.focus || "all";

    return {
      description: "Audit Svelte 5 code for best practices and optimization opportunities",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please audit this Svelte code with focus on: ${focus}

\`\`\`svelte
${code}
\`\`\`

Audit checklist:
- ✅ Svelte 5 runes usage ($state, $derived, $effect, $props)
- ✅ Modern event handling (onclick vs on:click)
- ✅ Snippets vs slots
- ✅ TypeScript integration
- ✅ Accessibility (ARIA, semantic HTML, keyboard navigation)
- ✅ Performance (derived vs effect usage, unnecessary re-renders)
- ✅ Code organization and readability
- ✅ Error handling and edge cases

Provide:
1. Issues found with severity (high/medium/low)
2. Specific code improvements with examples
3. Migration suggestions for Svelte 4 → 5 patterns if applicable
4. Performance optimization opportunities`,
          },
        },
      ],
    };
  }

  private async getExplainConceptPrompt(args: any) {
    const concept = args?.concept || "[Svelte 5 concept]";
    const level = args?.level || "intermediate";

    return {
      description: "Explain Svelte 5 concepts with detailed examples and comparisons",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Explain the Svelte 5 concept: "${concept}" at ${level} level

Please provide:
1. Clear definition and purpose
2. Syntax and usage examples
3. Comparison with Svelte 4 approach (if applicable)
4. When and why to use this feature
5. Common patterns and best practices
6. Potential gotchas or edge cases
7. Code examples showing practical implementation

Focus on practical understanding with working code examples that demonstrate the concept clearly.`,
          },
        },
      ],
    };
  }

  private async getSearchPatternsPrompt(args: any) {
    const pattern = args?.pattern || "[pattern or feature]";
    const context = args?.context || "";

    return {
      description: "Search for specific Svelte 5 patterns and implementations",
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Find Svelte 5 patterns for: "${pattern}"

${context ? `Additional context: ${context}` : ""}

Please search the knowledge base and provide:
1. Relevant patterns and implementations
2. Code examples using Svelte 5 features
3. Best practices for this specific use case
4. Alternative approaches and trade-offs
5. Common mistakes to avoid

Focus on modern Svelte 5 approaches using runes, snippets, and enhanced reactivity.`,
          },
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new Svelte5MCPServer();
server.run().catch(console.error);