import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

const claudeMdPath = join(import.meta.dir, "..", "CLAUDE.md");
const content = existsSync(claudeMdPath)
  ? readFileSync(claudeMdPath, "utf-8")
  : "";

describe("CLAUDE.md validation", () => {

  it("file exists and is not empty", () => {
    expect(existsSync(claudeMdPath)).toBe(true);
    expect(content.length).toBeGreaterThan(0);
  });

  it("contains project description (Jadlis, Bun monorepo)", () => {
    expect(content).toContain("Jadlis");
    expect(content).toMatch(/Bun\s+monorepo/i);
  });

  it("contains package structure (shared, bot, ai, mcp-servers)", () => {
    expect(content).toContain("shared/");
    expect(content).toContain("bot/");
    expect(content).toContain("ai/");
    expect(content).toContain("mcp-servers/");
  });

  it("contains commands (bun install, typecheck, test, dev)", () => {
    expect(content).toContain("bun install");
    expect(content).toContain("bun run typecheck");
    expect(content).toContain("bun test");
    expect(content).toContain("bun run dev");
  });

  it("contains code standards (TypeScript strict, Zod, Repository pattern)", () => {
    expect(content).toMatch(/strict/i);
    expect(content).toMatch(/Zod/);
    expect(content).toMatch(/[Rr]epository/);
  });

  it("contains git workflow (issue binding, commit format, PR required)", () => {
    expect(content).toMatch(/issue/i);
    expect(content).toMatch(/Closes #/);
    expect(content).toMatch(/PR/i);
  });

  it("contains CI-specific instructions (Russian, issue-linking)", () => {
    expect(content).toMatch(/русск/i);
    expect(content).toMatch(/issue/i);
  });

  it("contains security section (env, service_role, @tma.js, webhook)", () => {
    expect(content).toMatch(/\.env/);
    expect(content).toMatch(/SERVICE_ROLE/i);
    expect(content).toContain("@tma.js");
    expect(content).toMatch(/webhook/i);
  });

  it("distinguishes @tma.js/init-data-node (Mini App) and webhook header (Bot)", () => {
    expect(content).toContain("@tma.js/init-data-node");
    expect(content).toContain("X-Telegram-Bot-Api-Secret-Token");
  });

  it("does NOT contain hardcoded secrets or API keys", () => {
    expect(content).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(content).not.toMatch(/eyJ[a-zA-Z0-9._-]{50,}/);
    expect(content).not.toMatch(/ANTHROPIC_API_KEY\s*=\s*\S+/);
    expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/);
    expect(content).not.toMatch(/\d{8,10}:[A-Za-z0-9_-]{35}/);
  });
});
