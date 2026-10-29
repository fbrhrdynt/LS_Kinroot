import test from "node:test";
import assert from "node:assert/strict";
import { route, intersects } from "../src/routing.js";
test("visibility router avoids a card blocking a straight segment", () => {
  const r = { x: 40, y: 20, w: 20, h: 60 },
    out = route(
      [
        [0, 50],
        [100, 50],
      ],
      [r],
    );
  assert.deepEqual(out[0], [0, 50]);
  assert.deepEqual(out.at(-1), [100, 50]);
  assert(out.length > 2);
  for (let i = 1; i < out.length; i++) {
    assert(out[i - 1][0] === out[i][0] || out[i - 1][1] === out[i][1]);
    assert(!intersects(out[i - 1], out[i], r));
  }
});
test("visibility router preserves unobstructed orthogonal route", () => {
  const p = [
    [0, 0],
    [0, 20],
    [100, 20],
  ];
  assert.deepEqual(route(p, [{ x: 40, y: 40, w: 20, h: 20 }]), p);
});
test("card boundary anchors do not count as card interior crossings", () => {
  const r = { x: 40, y: 20, w: 20, h: 60 };
  assert(!intersects([60, 50], [100, 50], r));
  assert(!intersects([0, 20], [100, 20], r));
});
