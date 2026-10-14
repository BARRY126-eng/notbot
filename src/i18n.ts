// UI translations. English is bundled; other languages load on demand.
import { type Lang, pickLang } from "../shared/types";
import { createStore } from "./store";
import { en, type Key } from "./i18n/en";

const loaders = import.meta.glob<{ default: Record<string, string> }>("./i18n/*.json");
const langStore = createStore<{ lang: Lang; dict: Record<string, string> }>({ lang: "en", dict: en });

export function getLang(): Lang {
  return langStore.get().lang;
}

export async function setLang(code: string | null | undefined) {
  const lang = pickLang(code);
  if (lang === "en") return langStore.set({ lang, dict: en });
  const load = loaders[`./i18n/${lang}.json`];
  const dict = load ? (await load()).default : {};
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  langStore.set({ lang, dict: { ...en, ...dict } });
}

export function t(key: Key, vars: Record<string, string | number> = {}): string {
  const tpl = langStore.get().dict[key] ?? en[key] ?? key;
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

/** Translates an API error code, falling back to a generic message */
export function tErr(code: string, details?: Record<string, any>): string {
  const key = `err.${code}` as Key;
  if (!(key in en)) return t(code === "NETWORK" ? "common.offline" : "common.error");
  return t(key, details ?? {});
}

/** Re-render on language change */
export const useLang = () => langStore.use();
export type { Key };
