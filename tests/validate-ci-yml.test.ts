import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { load } from "js-yaml";
import { join } from "path";

const ciPath = join(import.meta.dir, "../.github/workflows/ci.yml");
const ciContent = readFileSync(ciPath, "utf-8");
const ci = load(ciContent) as Record<string, any>;

describe("ci.yml", () => {
  test("YAML валидный (парсится без ошибок)", () => {
    expect(ci).toBeDefined();
    expect(ci.name).toBe("CI");
  });

  test("содержит concurrency group с fallback на github.sha", () => {
    expect(ci.concurrency).toBeDefined();
    expect(ci.concurrency.group).toContain("github.head_ref");
    expect(ci.concurrency.group).toContain("github.sha");
  });

  test("cancel-in-progress зависит от event_name", () => {
    expect(ci.concurrency["cancel-in-progress"]).toContain(
      "github.event_name"
    );
  });

  test("paths-ignore включает **.md, context/**, research/**, .claude/**", () => {
    const pathsIgnore = ci.on.pull_request["paths-ignore"] as string[];
    expect(pathsIgnore).toContain("**.md");
    expect(pathsIgnore).toContain("context/**");
    expect(pathsIgnore).toContain("research/**");
    expect(pathsIgnore).toContain(".claude/**");
  });

  test("paths-ignore НЕ включает supabase/migrations/**", () => {
    const pathsIgnore = ci.on.pull_request["paths-ignore"] as string[];
    expect(pathsIgnore).not.toContain("supabase/migrations/**");
  });

  test('job name === "tests" (для branch protection)', () => {
    expect(ci.jobs.ci.name).toBe("tests");
  });

  test("сохраняет существующие steps (checkout, setup-bun, install, typecheck, test)", () => {
    const steps = ci.jobs.ci.steps as Array<Record<string, any>>;
    expect(steps).toHaveLength(5);

    expect(steps[0].uses).toContain("actions/checkout@");
    expect(steps[1].name).toBe("Setup Bun");
    expect(steps[2].name).toBe("Install dependencies");
    expect(steps[3].name).toBe("Typecheck");
    expect(steps[4].name).toBe("Test");
  });
});
