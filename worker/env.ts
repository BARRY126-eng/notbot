export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  BOT_TOKEN: string;
  NOTPANEL_API_KEY: string;
  TG_WEBHOOK_SECRET: string;
  OWNER_IDS: string;
  /** Local development only: skip Telegram auth and act as this user id */
  DEV_FAKE_USER_ID?: string;
}

export function isOwner(env: Env, userId: number): boolean {
  return env.OWNER_IDS.split(",").map((s) => s.trim()).filter(Boolean).includes(String(userId));
}
