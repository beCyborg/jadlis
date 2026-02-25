import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const readmePath = join(import.meta.dir, "..", "README.md");

describe("README.md worktree documentation", () => {
  const content = readFileSync(readmePath, "utf-8");

  test("содержит секцию 'Параллельная разработка'", () => {
    expect(content).toContain("## Параллельная разработка");
  });

  test("описывает claude --worktree / claude -w", () => {
    expect(content).toContain("--worktree");
    expect(content).toContain("claude -w");
  });

  test("описывает --from-pr для resume", () => {
    expect(content).toContain("--from-pr");
  });

  test("описывает auto-cleanup", () => {
    expect(content).toContain("автоматическое удаление worktree");
  });
});
