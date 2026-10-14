// Telegram Mini App initData validation (HMAC-SHA256 with the bot token).
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export interface TgUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export interface InitData {
  user: TgUser;
  authDate: number;
  startParam: string | null;
}

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(data));
}

export function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Returns the parsed data, or null if the signature is wrong or the data is older than maxAgeSec. */
export async function validateInitData(
  raw: string,
  botToken: string,
  maxAgeSec = 86400,
  now = Math.floor(Date.now() / 1000),
): Promise<InitData | null> {
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const checkString = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const expected = toHex(await hmac(secret, checkString));
  if (!timingSafeEqual(expected, hash)) return null;

  const authDate = Number(params.get("auth_date"));
  if (!authDate || now - authDate > maxAgeSec) return null;
  const userJson = params.get("user");
  if (!userJson) return null;
  const user = JSON.parse(userJson) as TgUser;
  if (!user?.id) return null;
  return { user, authDate, startParam: params.get("start_param") };
}

/** HMAC-SHA256 hex of `${timestamp}.${body}` — NotPanel webhook signature */
export async function notpanelSignature(secret: string, timestamp: string, body: string): Promise<string> {
  return toHex(await hmac(enc.encode(secret), `${timestamp}.${body}`));
}
