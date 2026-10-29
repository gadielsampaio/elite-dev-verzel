import { test, expect } from "@playwright/test";
import { clock } from "../src/haus/model";

test("countdown shows days from 24 hours and clamps expired lots", () => {
  const now = Date.UTC(2026, 9, 29);
  for (const [seconds, expected] of [
    [-1, "00:00:00"],
    [0, "00:00:00"],
    [1, "00:00:01"],
    [86399, "23:59:59"],
    [86400, "1d 00:00:00"],
    [86401, "1d 00:00:01"],
    [183845, "2d 03:04:05"],
  ] as const)
    expect(clock(now + seconds * 1000, now)).toBe(expected);
});
