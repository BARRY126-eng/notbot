import { getLang } from "./i18n";

/** micro-USD → "$1.23" (3 decimals under $0.10) */
export function money(micro: number, opts: { sign?: boolean } = {}): string {
  const v = Math.abs(micro) / 1e6;
  const digits = v === 0 || v >= 0.1 ? 2 : v >= 0.01 ? 3 : 4;
  let s = v.toFixed(digits);
  if (digits > 2) s = s.replace(/(\.\d\d\d*?)0+$/, "$1");
  const sign = micro < 0 ? "−" : opts.sign && micro > 0 ? "+" : "";
  return `${sign}$${s}`;
}

const locale = () => (getLang() === "zh" ? "zh-CN" : getLang());

export function num(n: number): string {
  return n.toLocaleString(locale());
}

export function short(n: number): string {
  if (n >= 1_000_000) return +(n / 1_000_000).toFixed(1) + "M";
  if (n >= 1000) return +(n / 1000).toFixed(1) + "K";
  return String(n);
}

export function dateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString(locale(), { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function dayKey(ts: number): string {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayLabel(ts: number, today: string, yesterday: string): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return today;
  if (d.toDateString() === y.toDateString()) return yesterday;
  return d.toLocaleDateString(locale(), { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function duration(minutes: number, units: { m: string; h: string; d: string }): string {
  if (minutes < 60) return `${minutes} ${units.m}`;
  if (minutes <= 2880) return `${+(minutes / 60).toFixed(1)} ${units.h}`;
  return `${Math.round(minutes / 1440)} ${units.d}`;
}

/** Strips the scheme for display */
export function prettyLink(link: string): string {
  return link.replace(/^https?:\/\/(www\.)?/, "");
}
