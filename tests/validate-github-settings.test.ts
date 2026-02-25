import { describe, expect, it } from "bun:test";

const REPO = "beCyborg/jadlis";

function ghApi(endpoint: string): unknown {
  const proc = Bun.spawnSync(["gh", "api", `repos/${REPO}/${endpoint}`], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (proc.exitCode !== 0) return null;
  return JSON.parse(proc.stdout.toString());
}

describe("GitHub Settings verification", () => {
  it("ANTHROPIC_API_KEY exists in repo secrets", () => {
    const data = ghApi("actions/secrets") as {
      secrets: { name: string }[];
    } | null;
    expect(data).not.toBeNull();
    const names = data!.secrets.map((s) => s.name);
    expect(names).toContain("ANTHROPIC_API_KEY");
  });

  // Branch protection requires GitHub Pro for private repos.
  // These tests are skipped until repo becomes public or Pro is enabled.
  it.skip("branch protection requires PR before merging", () => {
    const data = ghApi("branches/main/protection") as Record<
      string,
      unknown
    > | null;
    expect(data).not.toBeNull();
    expect(data!.required_pull_request_reviews).not.toBeNull();
  });

  it.skip('branch protection requires "tests" status check', () => {
    const data = ghApi("branches/main/protection") as {
      required_status_checks?: { checks: { context: string }[] };
    } | null;
    expect(data).not.toBeNull();
    const checks =
      data!.required_status_checks?.checks.map((c) => c.context) ?? [];
    expect(checks).toContain("tests");
  });

  it.skip("branch protection requires branches up to date", () => {
    const data = ghApi("branches/main/protection") as {
      required_status_checks?: { strict: boolean };
    } | null;
    expect(data).not.toBeNull();
    expect(data!.required_status_checks?.strict).toBe(true);
  });

  it.skip("Claude Review is NOT a required status check", () => {
    const data = ghApi("branches/main/protection") as {
      required_status_checks?: { checks: { context: string }[] };
    } | null;
    if (!data?.required_status_checks) return;
    const checks = data.required_status_checks.checks.map((c) => c.context);
    expect(checks).not.toContain("Claude Review");
    expect(checks).not.toContain("claude-review");
  });

  it.skip("Security Review is NOT a required status check", () => {
    const data = ghApi("branches/main/protection") as {
      required_status_checks?: { checks: { context: string }[] };
    } | null;
    if (!data?.required_status_checks) return;
    const checks = data.required_status_checks.checks.map((c) => c.context);
    expect(checks).not.toContain("Security Review");
    expect(checks).not.toContain("security-review");
  });
});
