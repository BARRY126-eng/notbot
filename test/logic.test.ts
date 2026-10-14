import { describe, expect, it } from "vitest";
import { notpanelSignature, toHex, validateInitData } from "../worker/auth";
import { checkDraft, orderCharge, sellRate } from "../worker/pricing";

const enc = new TextEncoder();
async function hmac(key: Uint8Array<ArrayBuffer> | ArrayBuffer, data: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}
async function signInitData(token: string, fields: Record<string, string>) {
  const check = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = await hmac(enc.encode("WebAppData"), token);
  const hash = toHex(await hmac(secret, check));
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("pricing", () => {
  it("adds markup and rounds up to $0.0001", () => {
    expect(sellRate(52_000, 30, null)).toBe(67_600);
    expect(sellRate(5_200, 30, null)).toBe(6_800); // 0.00676 → 0.0068
    expect(sellRate(52_000, 30, 90_000)).toBe(90_000); // fixed price wins
  });
  it("charges per 1,000 and whole packages", () => {
    expect(orderCharge(130_000, 1000, "free")).toBe(130_000);
    expect(orderCharge(130_000, 10, "free")).toBe(1_300);
    expect(orderCharge(103_125_000, 1, "fixed")).toBe(103_125_000);
    expect(orderCharge(1, 1, "free")).toBe(1); // never zero
  });
  it("validates drafts", () => {
    const svc = { type_key: "default", min: 10, max: 1000, step: 1, fields: [], dripfeed: false, dripMax: null };
    expect(checkDraft(svc, { link: "https://t.me/x/1", quantity: 5 })).toEqual({ error: "MINIMUM_QUANTITY", details: { n: 10 } });
    expect(checkDraft(svc, { link: "", quantity: 50 })).toEqual({ error: "INVALID_LINK" });
    expect(checkDraft(svc, { link: "https://t.me/x/1", quantity: 50 })).toEqual({ quantity: 50, fields: {} });
    const comments = { ...svc, min: 1, type_key: "custom_comments", fields: [{ key: "comments", kind: "lines" as const, required: true, label: "" }] };
    expect(checkDraft(comments, { link: "https://x.com/a", fields: { comments: "a\n\nb\n c " } })).toEqual({
      quantity: 3,
      fields: { comments: "a\nb\nc" },
    } as never);
  });
});

describe("telegram initData", () => {
  const token = "123456:TEST";
  const user = JSON.stringify({ id: 42, first_name: "A" });
  it("accepts a correctly signed payload", async () => {
    const now = 1_800_000_000;
    const raw = await signInitData(token, { auth_date: String(now), user, query_id: "q" });
    const r = await validateInitData(raw, token, 86400, now + 10);
    expect(r?.user.id).toBe(42);
  });
  it("rejects tampering, wrong token and stale data", async () => {
    const now = 1_800_000_000;
    const raw = await signInitData(token, { auth_date: String(now), user });
    expect(await validateInitData(raw.replace("42", "43"), token, 86400, now)).toBeNull();
    expect(await validateInitData(raw, "999:OTHER", 86400, now)).toBeNull();
    expect(await validateInitData(raw, token, 86400, now + 90000)).toBeNull();
  });
});

describe("notpanel webhook signature", () => {
  it("is HMAC-SHA256 of timestamp.body", async () => {
    const sig = await notpanelSignature("secret", "1700000000", '{"a":1}');
    const expected = toHex(await hmac(enc.encode("secret"), '1700000000.{"a":1}'));
    expect(sig).toBe(expected);
  });
});
