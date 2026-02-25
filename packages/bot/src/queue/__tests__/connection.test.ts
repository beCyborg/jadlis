import { describe, it, expect, beforeEach, mock } from "bun:test";

// Mock ioredis before importing connection module
const mockInstance = {
  disconnect: mock(() => {}),
  connect: mock(() => Promise.resolve()),
  status: "ready",
};
const MockIORedis = mock(() => mockInstance);

mock.module("ioredis", () => ({
  default: MockIORedis,
}));

// Import after mocking
const { getRedisConnection, resetRedisConnection } = await import("../connection");

describe("getRedisConnection", () => {
  beforeEach(() => {
    resetRedisConnection();
    MockIORedis.mockClear();
    process.env.REDIS_URL = "redis://test-host:6380";
  });

  it("returns IORedis instance with REDIS_URL from env", () => {
    const conn = getRedisConnection();
    expect(conn).toBeDefined();
    expect(MockIORedis).toHaveBeenCalledTimes(1);
    expect((MockIORedis.mock.calls[0] as any[])[0]).toBe("redis://test-host:6380");
  });

  it("returns same instance on repeated calls (singleton)", () => {
    const conn1 = getRedisConnection();
    const conn2 = getRedisConnection();
    expect(conn1).toBe(conn2);
    expect(MockIORedis).toHaveBeenCalledTimes(1);
  });

  it("sets maxRetriesPerRequest to null (BullMQ requirement)", () => {
    getRedisConnection();
    const options = (MockIORedis.mock.calls[0] as any[])[1];
    expect(options).toHaveProperty("maxRetriesPerRequest", null);
  });

  it("sets lazyConnect to true for cold-start resilience", () => {
    getRedisConnection();
    const options = (MockIORedis.mock.calls[0] as any[])[1];
    expect(options).toHaveProperty("lazyConnect", true);
  });

  it("uses default redis://localhost:6379 when REDIS_URL not set", () => {
    delete process.env.REDIS_URL;
    getRedisConnection();
    expect((MockIORedis.mock.calls[0] as any[])[0]).toBe("redis://localhost:6379");
  });
});
