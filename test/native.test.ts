// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { isNative, noticeId } from "@/lib/native";

describe("native bridge", () => {
  afterEach(() => {
    delete (window as unknown as { Capacitor?: unknown }).Capacitor;
  });

  it("is off in a normal browser", () => {
    expect(isNative()).toBe(false);
  });

  it("detects the Capacitor iOS shell", () => {
    (window as unknown as { Capacitor: unknown }).Capacitor = { isNativePlatform: () => true };
    expect(isNative()).toBe(true);
  });

  it("maps alert ids to stable positive notification ids", () => {
    const a = noticeId("quake:us7000abcd");
    expect(a).toBe(noticeId("quake:us7000abcd"));
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(2 ** 31);
    expect(noticeId("quake:us7000abce")).not.toBe(a);
  });
});
