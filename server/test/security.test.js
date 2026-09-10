import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test("security headers middleware", async (t) => {
  const db = await openDatabase(":memory:");
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  await t.test("should set security headers on responses", async () => {
    const res = await fetch(`${url}/health`);
    assert.ok(res.headers.has("x-content-type-options"));
    assert.ok(res.headers.has("x-frame-options"));
  });
});

test("rate limiting", async (t) => {
  const db = await openDatabase(":memory:");
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  await t.test("should rate limit authentication endpoints", async () => {
    const attempts = [];

    // Make 6 rapid requests (limit is 5 per 15 minutes)
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${url}/api/farmers/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "0888999999", pin: "9999" }),
      });
      attempts.push(res.status);
    }

    // Last request should be rate limited
    const rateLimited = attempts[5] === 429;
    assert.ok(rateLimited, "Expected 6th auth request to be rate limited");
  });
});

test("input sanitization", async (t) => {
  const db = await openDatabase(":memory:");
  const app = createApp(db, { jwtSecret: "test-secret" });
  const { url, close } = await listen(app);
  t.after(close);

  await t.test("should handle requests without crashing", async () => {
    // Just test that the middleware doesn't crash the app
    const res = await fetch(`${url}/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
  });
});
