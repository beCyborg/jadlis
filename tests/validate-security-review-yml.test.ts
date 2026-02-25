import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

const ymlPath = join(
  import.meta.dir,
  "../.github/workflows/security-review.yml"
);
const content = readFileSync(ymlPath, "utf-8");
const wf = load(content) as Record<string, any>;

describe("security-review.yml", () => {
  test("YAML валидный", () => {
    expect(wf).toBeDefined();
    expect(wf.name).toBe("Security Review");
  });

  test("триггер — pull_request branches [main]", () => {
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

  test("action — anthropics/claude-code-security-review@main", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const secStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("security-review")
    );
    expect(secStep).toBeDefined();
    expect(secStep!.uses).toBe("anthropics/claude-code-security-review@main");
  });

  test("claude-api-key использует secrets.ANTHROPIC_API_KEY", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const secStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("security-review")
    );
    expect(secStep!.with["claude-api-key"]).toContain("secrets.ANTHROPIC_API_KEY");
  });

  test("claude-model содержит claude-sonnet-4-6", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const secStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("security-review")
    );
    expect(secStep!.with["claude-model"]).toBe("claude-sonnet-4-6");
  });

  test("comment-pr: true", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const secStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("security-review")
    );
    expect(secStep!.with["comment-pr"]).toBe(true);
  });

  test("exclude-directories содержит node_modules,dist,coverage,context,research,.claude", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const secStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("security-review")
    );
    const dirs = secStep!.with["exclude-directories"] as string;
    expect(dirs).toContain("node_modules");
    expect(dirs).toContain("dist");
    expect(dirs).toContain("coverage");
    expect(dirs).toContain("context");
    expect(dirs).toContain("research");
    expect(dirs).toContain(".claude");
  });

  test("claudecode-timeout <= 15", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const secStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("security-review")
    );
    expect(secStep!.with["claudecode-timeout"]).toBeLessThanOrEqual(15);
  });

  test("checkout с fetch-depth: 2", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const checkoutStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("actions/checkout")
    );
    expect(checkoutStep!.with["fetch-depth"]).toBe(2);
  });

  test("checkout с ref: github.event.pull_request.head.sha", () => {
    const steps = wf.jobs["security-review"].steps as Array<Record<string, any>>;
    const checkoutStep = steps.find(
      (s: Record<string, any>) => s.uses && s.uses.includes("actions/checkout")
    );
    expect(checkoutStep!.with.ref).toContain("pull_request.head.sha");
  });

  test("permissions содержит contents: read", () => {
    expect(wf.permissions.contents).toBe("read");
  });

  test("permissions содержит pull-requests: write", () => {
    expect(wf.permissions["pull-requests"]).toBe("write");
  });

  test("concurrency group отличается от claude-review", () => {
    expect(wf.concurrency.group).toContain("security-");
    expect(wf.concurrency.group).not.toContain("claude-review");
  });
});
