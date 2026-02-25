import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

const ymlPath = join(
  import.meta.dir,
  "../.github/workflows/claude-review.yml"
);
const content = readFileSync(ymlPath, "utf-8");
const wf = load(content) as Record<string, any>;

describe("claude-review.yml", () => {
  test("YAML валидный", () => {
    expect(wf).toBeDefined();
    expect(wf.name).toBe("Claude Review");
  });

  test("триггер — pull_request с types [opened, synchronize]", () => {
    const types = wf.on.pull_request.types;
    expect(types).toContain("opened");
    expect(types).toContain("synchronize");
  });

  test("триггер — branches [main]", () => {
    expect(wf.on.pull_request.branches).toContain("main");
  });

  test("paths-ignore совпадает с ci.yml", () => {
    const pi = wf.on.pull_request["paths-ignore"] as string[];
    expect(pi).toContain("**.md");
    expect(pi).toContain("context/**");
    expect(pi).toContain("research/**");
    expect(pi).toContain(".claude/**");
    expect(pi).toContain("supabase/seed.sql");
    expect(pi).not.toContain("supabase/migrations/**");
  });

  test("concurrency group содержит github.head_ref", () => {
    expect(wf.concurrency.group).toContain("github.head_ref");
  });

  test("cancel-in-progress: true", () => {
    expect(wf.concurrency["cancel-in-progress"]).toBe(true);
  });

  test("permissions содержит contents: read (НЕ write)", () => {
    expect(wf.permissions.contents).toBe("read");
  });

  test("permissions содержит pull-requests: write", () => {
    expect(wf.permissions["pull-requests"]).toBe("write");
  });

  test("action — anthropics/claude-code-action@v1", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep).toBeDefined();
    expect(claudeStep!.uses).toBe("anthropics/claude-code-action@v1");
  });

  test("claude_args содержит --model claude-sonnet-4-6", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep!.with.claude_args).toContain("claude-sonnet-4-6");
  });

  test("claude_args содержит --mcp-config с runner.temp", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep!.with.claude_args).toContain("mcp-config");
    expect(claudeStep!.with.claude_args).toContain("runner.temp");
  });

  test("claude_args содержит --allowedTools с context7 tools", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep!.with.claude_args).toContain("context7");
  });

  test("MCP config создаётся в $RUNNER_TEMP", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const mcpStep = steps.find(
      (s: Record<string, any>) => s.name && s.name.includes("MCP")
    );
    expect(mcpStep).toBeDefined();
    expect(mcpStep!.run).toContain("RUNNER_TEMP");
  });

  test("MCP config содержит context7 URL", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const mcpStep = steps.find(
      (s: Record<string, any>) => s.name && s.name.includes("MCP")
    );
    expect(mcpStep!.run).toContain("mcp.context7.com");
  });

  test("prompt содержит инструкции на русском", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep!.with.prompt).toContain("русском");
  });

  test("anthropic_api_key использует secrets.ANTHROPIC_API_KEY", () => {
    const steps = wf.jobs.review.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep!.with.anthropic_api_key).toContain(
      "secrets.ANTHROPIC_API_KEY"
    );
  });
});
