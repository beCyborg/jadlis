import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const MIGRATIONS_DIR = join(import.meta.dir, "..");

let sql001: string;
let sql002: string;
let sql003: string;

beforeAll(() => {
  sql001 = readFileSync(join(MIGRATIONS_DIR, "001_initial_schema.sql"), "utf-8");
  sql002 = readFileSync(join(MIGRATIONS_DIR, "002_vector_tables.sql"), "utf-8");
  sql003 = readFileSync(join(MIGRATIONS_DIR, "003_functions.sql"), "utf-8");
});

describe("001_initial_schema.sql", () => {
  const expectedTables = [
    "users",
    "needs",
    "metrics",
    "metric_values",
    "days",
    "weeks",
    "months",
    "quarters",
    "goals",
    "stages",
    "tasks",
    "habits",
    "habit_completions",
    "bot_sessions",
    "swot",
    "energy_leaks",
  ];

  it("creates all 16 expected tables", () => {
    for (const table of expectedTables) {
      expect(sql001).toContain(`CREATE TABLE ${table}`);
    }
  });

  it("creates indexes on metric_values (metric_id, recorded_at DESC)", () => {
    expect(sql001).toMatch(/CREATE INDEX.*metric_values.*metric_id.*recorded_at/i);
  });

  it("creates indexes on metric_values (user_id, recorded_at DESC)", () => {
    expect(sql001).toMatch(/CREATE INDEX.*metric_values.*user_id.*recorded_at/i);
  });

  it("creates indexes on habit_completions (habit_id, completed_at DESC)", () => {
    expect(sql001).toMatch(/CREATE INDEX.*habit_completions.*habit_id.*completed_at/i);
  });

  it("creates indexes on habit_completions (user_id, completed_at DESC)", () => {
    expect(sql001).toMatch(/CREATE INDEX.*habit_completions.*user_id.*completed_at/i);
  });

  it("metrics table has scale_target and scale_threshold columns", () => {
    expect(sql001).toMatch(/scale_target/);
    expect(sql001).toMatch(/scale_threshold/);
  });

  it("metrics table matches TypeScript Metric interface fields", () => {
    // Verify all fields from shared/src/types/metric.ts
    const metricSection = sql001.slice(
      sql001.indexOf("CREATE TABLE metrics"),
      sql001.indexOf(";", sql001.indexOf("CREATE TABLE metrics")) + 1
    );
    for (const field of ["need_id", "name", "code", "type", "level", "scale_type", "scale_min", "scale_max", "weight"]) {
      expect(metricSection).toContain(field);
    }
  });

  it("habits table uses momentum on 0-100 scale (not 0-1)", () => {
    const habitsSection = sql001.slice(
      sql001.indexOf("CREATE TABLE habits"),
      sql001.indexOf(";", sql001.indexOf("CREATE TABLE habits")) + 1
    );
    // Momentum should be NUMERIC(5,2) for 0-100 scale, not NUMERIC(5,4) for 0-1
    expect(habitsSection).toMatch(/momentum\s+NUMERIC\(5,2\)/i);
  });
});

describe("002_vector_tables.sql", () => {
  it("enables pgvector extension", () => {
    expect(sql002).toMatch(/CREATE EXTENSION.*vector/i);
  });

  it("creates jadlis_documents with vector(1024) column", () => {
    expect(sql002).toContain("vector(1024)");
    expect(sql002).toContain("CREATE TABLE jadlis_documents");
  });

  it("creates HNSW index with m=16 and ef_construction=64", () => {
    expect(sql002).toMatch(/USING hnsw/i);
    expect(sql002).toMatch(/m\s*=\s*16/);
    expect(sql002).toMatch(/ef_construction\s*=\s*64/);
  });

  it("creates memory_facts table", () => {
    expect(sql002).toContain("CREATE TABLE memory_facts");
  });

  it("memory_facts has UNIQUE(user_id, key)", () => {
    const factsSection = sql002.slice(
      sql002.indexOf("CREATE TABLE memory_facts"),
      sql002.indexOf(";", sql002.indexOf("CREATE TABLE memory_facts")) + 1
    );
    expect(factsSection).toMatch(/UNIQUE.*user_id.*key/i);
  });
});

describe("003_functions.sql", () => {
  it("defines search_documents function", () => {
    expect(sql003).toMatch(/CREATE OR REPLACE FUNCTION search_documents/);
  });

  it("search_documents accepts similarity_threshold parameter", () => {
    expect(sql003).toContain("similarity_threshold");
  });

  it("search_documents filters by source_type via p_source_types", () => {
    expect(sql003).toContain("p_source_types");
  });

  it("defines calculate_need_score function with weighted mean", () => {
    expect(sql003).toMatch(/CREATE OR REPLACE FUNCTION calculate_need_score/);
    // Should implement weighted mean, not just a stub
    expect(sql003).toContain("weight");
  });

  it("calculate_need_score implements CV penalty and floor penalty", () => {
    // CV = stddev / mean * 100, penalty = 0.15 * CV
    expect(sql003).toMatch(/0\.15/);
    // Floor penalty: threshold at 20
    expect(sql003).toMatch(/floor_penalty|FloorPenalty|floor_mult/i);
  });

  it("defines update_habit_momentum function with EWMA alpha=0.3 on 0-100 scale", () => {
    expect(sql003).toMatch(/CREATE OR REPLACE FUNCTION update_habit_momentum/);
    expect(sql003).toMatch(/0\.3/);
    // Should use 100 scale (completed * 100), not 0-1
    expect(sql003).toContain("100");
  });
});
