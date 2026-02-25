import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

const ymlPath = join(
  import.meta.dir,
  "../.github/workflows/claude-interactive.yml"
);
const content = readFileSync(ymlPath, "utf-8");
const wf = load(content) as Record<string, any>;

describe("claude-interactive.yml", () => {
  test("YAML валидный", () => {
    expect(wf).toBeDefined();
    expect(wf.name).toBe("Claude Interactive");
  });

  test("триггеры — issue_comment [created] + pull_request_review_comment [created]", () => {
    expect(wf.on.issue_comment.types).toContain("created");
    expect(wf.on.pull_request_review_comment.types).toContain("created");
  });

  test("триггеры НЕ содержат issues: [opened, assigned]", () => {
    expect(wf.on.issues).toBeUndefined();
  });

  test("concurrency cancel-in-progress: false", () => {
    expect(wf.concurrency["cancel-in-progress"]).toBe(false);
  });

  test("concurrency group использует issue.number или pull_request.number", () => {
    const group = wf.concurrency.group;
    expect(group).toContain("issue.number");
    expect(group).toContain("pull_request.number");
  });

  test("permissions содержит contents: write", () => {
    expect(wf.permissions.contents).toBe("write");
  });

  test("action — anthropics/claude-code-action@v1", () => {
    const steps = wf.jobs.claude.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep).toBeDefined();
    expect(claudeStep!.uses).toBe("anthropics/claude-code-action@v1");
  });

  test("claude_args содержит --model claude-sonnet-4-6", () => {
    const steps = wf.jobs.claude.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep!.with.claude_args).toContain("claude-sonnet-4-6");
  });

  test("MCP config создаётся в $RUNNER_TEMP", () => {
    const steps = wf.jobs.claude.steps as Array<Record<string, any>>;
    const mcpStep = steps.find(
      (s: Record<string, any>) => s.name && s.name.includes("MCP")
    );
    expect(mcpStep).toBeDefined();
    expect(mcpStep!.run).toContain("RUNNER_TEMP");
  });

  test("MCP config содержит context7 URL", () => {
    const steps = wf.jobs.claude.steps as Array<Record<string, any>>;
    const mcpStep = steps.find(
      (s: Record<string, any>) => s.name && s.name.includes("MCP")
    );
    expect(mcpStep!.run).toContain("mcp.context7.com");
  });

  test("trigger_phrase установлен в @claude", () => {
    const steps = wf.jobs.claude.steps as Array<Record<string, any>>;
    const claudeStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("claude-code-action")
    );
    expect(claudeStep!.with.trigger_phrase).toBe("@claude");
  });

  test("if condition проверяет @claude в комментарии", () => {
    const condition = wf.jobs.claude.if;
    expect(condition).toContain("@claude");
    expect(condition).toContain("contains");
  });

  test("if condition проверяет author_association", () => {
    const condition = wf.jobs.claude.if;
    expect(condition).toContain("author_association");
    expect(condition).toContain("OWNER");
    expect(condition).toContain("MEMBER");
    expect(condition).toContain("COLLABORATOR");
  });

  test("timeout-minutes установлен", () => {
    expect(wf.jobs.claude["timeout-minutes"]).toBe(30);
  });
});
