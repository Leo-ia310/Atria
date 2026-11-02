import { test } from "node:test";
import assert from "node:assert/strict";
import { ChangeRefreshController } from "../../lib/client/change-refresh";
test("idle pages do not refresh; active edits defer one update", async () => {
  let now = 0,
    busy = false,
    refreshes = 0,
    calls = 0,
    changed = false;
  const cursors: (string | null)[] = [];
  const controller = new ChangeRefreshController({
    cursor: "initial",
    check: async (cursor) => {
      calls++;
      cursors.push(cursor);
      return { cursor: `cursor-${calls}`, changed };
    },
    visible: () => true,
    busy: () => busy,
    refresh: () => refreshes++,
    now: () => now,
  });
  await controller.poll();
  assert.equal(refreshes, 0);
  now += 15000;
  changed = true;
  busy = true;
  await controller.poll();
  assert.equal(refreshes, 0);
  busy = false;
  controller.flush();
  controller.flush();
  assert.equal(refreshes, 1);
  assert.deepEqual(cursors, ["initial", "cursor-1"]);
  now += 15000;
  changed = false;
  await controller.poll();
  assert.equal(refreshes, 1);
});
test("hidden tabs and repeated focus do not issue aggressive requests", async () => {
  let now = 0,
    visible = false,
    calls = 0;
  const controller = new ChangeRefreshController({
    cursor: null,
    check: async () => {
      calls++;
      return { cursor: "next", changed: false };
    },
    visible: () => visible,
    busy: () => false,
    refresh: () => assert.fail(),
    now: () => now,
  });
  await controller.poll();
  assert.equal(calls, 0);
  visible = true;
  await controller.poll();
  now += 100;
  await controller.poll();
  assert.equal(calls, 1);
  now += 15000;
  await controller.poll();
  assert.equal(calls, 2);
});
test("requests cannot overlap and unmount cancels deferred refresh", async () => {
  let resolve!: (v: { cursor: string; changed: boolean }) => void,
    calls = 0,
    refreshes = 0;
  const controller = new ChangeRefreshController({
    cursor: null,
    check: () => {
      calls++;
      return new Promise((r) => {
        resolve = r;
      });
    },
    visible: () => true,
    busy: () => false,
    refresh: () => refreshes++,
  });
  const pending = controller.poll();
  await controller.poll();
  assert.equal(calls, 1);
  controller.stop();
  resolve({ cursor: "next", changed: true });
  await pending;
  assert.equal(refreshes, 0);
});
test("network errors back off and a successful check restores the interval", async () => {
  let now = 0,
    fail = true;
  const controller = new ChangeRefreshController({
    cursor: null,
    check: async () => {
      if (fail) throw Error("offline");
      return { cursor: "next", changed: false };
    },
    visible: () => true,
    busy: () => false,
    refresh: () => assert.fail(),
    now: () => now,
  });
  for (const expected of [30000, 60000, 120000, 240000, 300000]) {
    assert.equal(await controller.poll(), expected);
    now += expected;
  }
  fail = false;
  assert.equal(await controller.poll(), 15000);
});
