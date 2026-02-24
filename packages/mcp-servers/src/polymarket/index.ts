import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const GAMMA_API = "https://gamma-api.polymarket.com";

// ============================================================
// MCP response helpers
// ============================================================

type McpResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(data: unknown): McpResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function err(message: string): McpResult {
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// ============================================================
// Probability parsing
// ============================================================

interface RawMarket {
  id: string;
  question: string;
  outcomePrices?: string;
  tokens?: { price: string | number }[];
  volume?: number;
  volumeNum?: number;
}

interface MappedMarket {
  id: string;
  question: string;
  probability: number;
  volume: number;
}

function parseProbability(market: RawMarket): number {
  if (market.outcomePrices) {
    try {
      const prices: unknown[] = JSON.parse(market.outcomePrices);
      return parseFloat(String(prices[0])) || 0;
    } catch {
      return 0;
    }
  }
  if (market.tokens?.[0]?.price != null) {
    return parseFloat(String(market.tokens[0].price));
  }
  return 0;
}

function mapMarket(m: RawMarket): MappedMarket {
  return {
    id: m.id,
    question: m.question,
    probability: parseProbability(m),
    volume: m.volume ?? m.volumeNum ?? 0,
  };
}

// ============================================================
// Exported handler functions (testable)
// ============================================================

export async function searchMarkets(keyword: string, limit: number = 10): Promise<McpResult> {
  try {
    const url = `${GAMMA_API}/markets?q=${encodeURIComponent(keyword)}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) return err(`Gamma API: ${response.status}`);
    const markets: unknown = await response.json();
    return ok(Array.isArray(markets) ? (markets as RawMarket[]).map(mapMarket) : []);
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function getMarketProbability(marketId: string): Promise<McpResult> {
  try {
    const url = `${GAMMA_API}/markets/${marketId}`;
    const response = await fetch(url);
    if (!response.ok) return err(`Gamma API: ${response.status}`);
    const market = await response.json() as RawMarket;
    return ok({
      id: market.id,
      question: market.question,
      probability: parseProbability(market),
    });
  } catch (e: unknown) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

export async function getMarketsForTopics(topics: string[], limit: number = 5): Promise<McpResult> {
  const results: Record<string, MappedMarket[]> = {};
  for (const topic of topics) {
    try {
      const url = `${GAMMA_API}/markets?q=${encodeURIComponent(topic)}&limit=${limit}`;
      const response = await fetch(url);
      if (!response.ok) {
        results[topic] = [];
        continue;
      }
      const markets: unknown = await response.json();
      results[topic] = Array.isArray(markets) ? (markets as RawMarket[]).map(mapMarket) : [];
    } catch {
      results[topic] = [];
    }
  }
  return ok(results);
}

// ============================================================
// MCP Server setup
// ============================================================

export function createServer(): McpServer {
  const server = new McpServer({ name: "jadlis-polymarket", version: "1.0.0" });

  server.tool("search_markets", "Search Polymarket prediction markets by keyword",
    { keyword: z.string(), limit: z.number().int().min(1).max(50).default(10) },
    async ({ keyword, limit }) => searchMarkets(keyword, limit));

  server.tool("get_market_probability", "Get current probability for a specific market",
    { market_id: z.string() },
    async ({ market_id }) => getMarketProbability(market_id));

  server.tool("get_markets_for_topics", "Batch search: one call per topic, returns map of topic to markets",
    { topics: z.array(z.string()), limit: z.number().int().min(1).max(50).default(5) },
    async ({ topics, limit }) => getMarketsForTopics(topics, limit));

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
