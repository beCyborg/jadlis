import FirecrawlApp from "@mendable/firecrawl-js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ============================================================
// Client
// ============================================================

let _firecrawl: FirecrawlApp | null = null;
function getFirecrawl(): FirecrawlApp {
  if (!_firecrawl) {
    if (!process.env.FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is required");
    }
    _firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
  }
  return _firecrawl;
}

// ============================================================
// MCP response helpers
// ============================================================

type McpResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): McpResult {
  return { content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] };
}

function err(message: string): McpResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// ============================================================
// Exported handler functions (testable)
// ============================================================

export async function scrapePage(url: string): Promise<McpResult> {
  try {
    const result = await getFirecrawl().scrapeUrl(url, { formats: ["markdown"] });
    if (!result.success) return err("Scrape failed");
    return ok(result.markdown ?? "");
  } catch (e: any) {
    return err(e.message);
  }
}

export async function extractStructured(
  url: string, schema: Record<string, unknown>, prompt?: string,
): Promise<McpResult> {
  try {
    const opts: any = { schema };
    if (prompt) opts.prompt = prompt;
    const result = await getFirecrawl().extract([url], opts);
    if (!result.success) return err("Extraction failed");
    return ok(result.data);
  } catch (e: any) {
    return err(e.message);
  }
}

export async function batchExtract(
  urls: string[], schema?: Record<string, unknown>,
): Promise<McpResult> {
  const results: (unknown | null)[] = [];
  for (const url of urls) {
    try {
      if (schema) {
        const result = await getFirecrawl().extract([url], { schema });
        results.push(result.success ? result.data : null);
      } else {
        const result = await getFirecrawl().scrapeUrl(url, { formats: ["markdown"] });
        results.push(result.success ? result.markdown : null);
      }
    } catch {
      results.push(null);
    }
  }
  return ok(results);
}

// ============================================================
// MCP Server setup
// ============================================================

export function createServer(): McpServer {
  const server = new McpServer({ name: "jadlis-firecrawl", version: "1.0.0" });

  server.tool("scrape_page", "Scrape a web page and return its content as markdown",
    { url: z.string().url() },
    async ({ url }) => scrapePage(url));

  server.tool("extract_structured", "Extract structured data from a page using a JSON schema",
    { url: z.string().url(), schema: z.record(z.unknown()), prompt: z.string().optional() },
    async ({ url, schema, prompt }) => extractStructured(url, schema, prompt));

  server.tool("batch_extract", "Extract from multiple URLs; partial failures return nulls",
    { urls: z.array(z.string().url()), schema: z.record(z.unknown()).optional() },
    async ({ urls, schema }) => batchExtract(urls, schema));

  return server;
}

// ============================================================
// Entry point
// ============================================================

if (import.meta.main) {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
