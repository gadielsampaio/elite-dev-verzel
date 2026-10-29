import { test, expect } from "@playwright/test";
import { legacyLinkTarget } from "../src/haus/app/routing/legacyLinks";

for (const [input, expected] of [
  ["/shadcn", "/#/home"],
  ["/lots/", "/#/home"],
  ["/shadcn?source=shared#/wallet?lot=123", "/?source=shared#/wallet?lot=123"],
  ["/lots/lot-id?source=shared", "/?source=shared#/lot/lot-id"],
  ["/login", "/#/login"],
  ["/register", "/#/register"],
  ["/wallet", "/#/wallet"],
  ["/seller", "/#/seller"],
  ["/activity", "/#/activity"],
  ["/audit", "/#/audit"],
  ["/#/home", null],
  ["/missing-page", null],
  ["/shadcn/missing-page", null],
] as const) {
  test(`legacy link normalization: ${input}`, () => {
    const url = new URL(input, "http://localhost");
    expect(legacyLinkTarget(url)).toBe(expected);
  });
}
