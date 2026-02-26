import { describe, it, expect, beforeEach } from "bun:test";
import { getRedisConnection, resetRedisConnection } from "../connection";

describe("getRedisConnection", () => {
  beforeEach(() => {
    resetRedisConnection();
    process.env.REDIS_URL = "redis://test-host:6380";
  });

  it("returns IORedis instance with REDIS_URL from env", () => {
    const conn = getRedisConnection();
    expect(conn).toBeDefined();
    // The mock IORedis stores url in _url
    expect((conn as any)._url).toBe("redis://test-host:6380");
  });

  it("returns same instance on repeated calls (singleton)", () => {
    const conn1 = getRedisConnection();
    const conn2 = getRedisConnection();
    expect(conn1).toBe(conn2);
  });

  it("sets maxRetriesPerRequest to null (BullMQ requirement)", () => {
    const conn = getRedisConnection();
    const options = (conn as any)._opts;
    expect(options).toHaveProperty("maxRetriesPerRequest", null);
  });

  it("sets lazyConnect to true for cold-start resilience", () => {
    const conn = getRedisConnection();
    const options = (conn as any)._opts;
    expect(options).toHaveProperty("lazyConnect", true);
  });

  it("uses default redis://localhost:6379 when REDIS_URL not set", () => {
    delete process.env.REDIS_URL;
    const conn = getRedisConnection();
    expect((conn as any)._url).toBe("redis://localhost:6379");
  });
});
