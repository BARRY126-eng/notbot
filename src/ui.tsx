import type { ComponentChildren } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { OrderStatus } from "../shared/types";
import { platformLogo } from "../shared/platforms";
import { ApiError } from "./api";
import { t, tErr } from "./i18n";
import { Icon, type IconName } from "./icons";
import { back, navigate, useRoute } from "./router";
import { createStore } from "./store";
import { haptic, hasSecondaryButton, inTelegram, useBackButton, useBottomButtons, type ButtonSpec } from "./tg";

// ---------- data loading ----------

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; error: unknown; loading: boolean; reload: () => void; set: (v: T) => void } {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true, error: undefined }));
    fn().then(
      (data) => live && setState({ data, loading: false }),
      (error) => live && setState({ error, loading: false }),
    );
    return () => {
      live = false;
    };
  }, [...deps, n]);
  return {
    data: state.data,
    error: state.error,
    loading: state.loading,
    reload: useCallback(() => setN((x) => x + 1), []),
    set: (data: T) => setState({ data, loading: false }),
  };
}

export const errText = (e: unknown) => (e instanceof ApiError ? tErr(e.code, e.details) : t("common.error"));

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div class="empty" role="alert">
      <span>{errText(error)}</span>
      <button class="btn soft sm" style="flex:none;padding:0 18px" onClick={onRetry}>
        {t("common.retry")}
      </button>
    </div>
  );
}

export function Skeleton({ h = 50, n = 1 }: { h?: number; n?: number }) {
  return (
    <div style="display:flex;flex-direction:column;gap:8px" aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} class="skel" style={`height:${h}px`} />
      ))}
    </div>
  );
}

// ---------- toast ----------

const toastStore = createStore<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  toastStore.set(msg);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastStore.set(null), 2600);
}
export function Toasts() {
  const msg = toastStore.use();
  return msg ? (
    <div class="toast" role="status">
      {msg}
    </div>
  ) : null;
}

// ---------- pieces ----------

export function PlatformLogo({ slug, size = 48, radius, on }: { slug: string; size?: number; radius?: number; on?: boolean }) {
  const src = platformLogo(slug);
  const img = Math.round(size * 0.56);
  return (
    <span class={`logo ${on ? "on" : ""}`} style={`width:${size}px;height:${size}px;${radius ? `border-radius:${radius}px` : ""}`}>
      {src ? <img src={src} alt="" width={img} height={img} loading="lazy" /> : <Icon name="more" size={img} stroke={3} />}
    </span>
  );
}

export function Row({
  icon,
  plate,
  lead,
  title,
  meta,
  value,
  chevron = true,
  onClick,
  href,
  children,
  danger,
  accent,
}: {
  icon?: IconName;
  plate?: string;
  lead?: ComponentChildren;
  title: ComponentChildren;
  meta?: ComponentChildren;
  value?: ComponentChildren;
  chevron?: boolean;
  onClick?: () => void;
  href?: string;
  children?: ComponentChildren;
  danger?: boolean;
  accent?: boolean;
}) {
  const inner = (
    <>
      {lead ?? (icon ? (
        <span class="tile" style={plate ? `background:${plate}` : undefined}>
          <Icon name={icon} size={18} stroke={1.8} />
        </span>
      ) : null)}
      <span class="body">
        <span class="grow">
          <span class="title ellipsis" style={danger ? "color:var(--destructive)" : accent ? "color:var(--acc)" : undefined}>
            {title}
          </span>
          {meta ? <span class="meta">{meta}</span> : null}
        </span>
        {value !== undefined ? <span class="value">{value}</span> : null}
        {children}
        {chevron && (onClick || href) ? <Icon name="chevron" size={14} stroke={2.6} class="chev" /> : null}
      </span>
    </>
  );
  const click = () => {
    haptic.tap();
    if (href) navigate(href);
    else onClick?.();
  };
  return onClick || href ? (
    <button type="button" class="row" onClick={click}>
      {inner}
    </button>
  ) : (
    <div class="row">{inner}</div>
  );
}

export function Switch({ on, label, onChange, disabled }: { on: boolean; label: string; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      class={`switch ${on ? "on" : ""}`}
      style="border:0;padding:0"
      onClick={(e) => {
        e.stopPropagation();
        haptic.select();
        onChange(!on);
      }}
    />
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={v === value}
          onClick={() => {
            haptic.select();
            onChange(v);
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const STATUS_CLASS: Record<OrderStatus, string> = {
  submitting: "st-pending",
  pending: "st-pending",
  processing: "st-progress",
  in_progress: "st-progress",
  completed: "st-done",
  partial: "st-partial",
  cancelled: "st-cancel",
  failed: "st-cancel",
};
export function StatusPill({ status }: { status: OrderStatus }) {
  return <span class={`status ${STATUS_CLASS[status]}`}>{t(`status.${status}`)}</span>;
}

export function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    ref.current?.addEventListener("keydown", key);
    ref.current?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  useBackButton(onClose);
  return (
    <div class="sheet-dim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <span class="grab" aria-hidden="true" />
        <div class="head">
          <div>
            <b>{title}</b>
            {sub ? <span class="sub">{sub}</span> : null}
          </div>
          <button type="button" class="iconbtn" aria-label={t("common.close")} onClick={onClose}>
            <Icon name="close" size={14} stroke={3} />
          </button>
        </div>
        <div class="scroll">{children}</div>
      </div>
    </div>
  );
}

// ---------- navigation chrome ----------

const TABS: [string, IconName, "tab.new" | "tab.orders" | "tab.wallet" | "tab.profile"][] = [
  ["/", "plusCircle", "tab.new"],
  ["/orders", "receipt", "tab.orders"],
  ["/wallet", "wallet", "tab.wallet"],
  ["/profile", "person", "tab.profile"],
];

export function TabBar() {
  const { path } = useRoute();
  return (
    <nav class="tabs" aria-label="Main">
      {TABS.map(([href, icon, key]) => (
        <a
          key={href}
          href={`#${href}`}
          aria-current={path === href ? "page" : undefined}
          onClick={(e) => {
            e.preventDefault();
            if (path !== href) {
              haptic.select();
              navigate(href, { replace: true });
            }
          }}
        >
          <Icon name={icon} size={22} stroke={path === href ? 2 : 1.8} />
          <span>{t(key)}</span>
        </a>
      ))}
    </nav>
  );
}

/** Telegram BackButton inside Telegram; a small back link in a normal browser (local dev). */
export function BackNav({ to }: { to: string }) {
  useBackButton(() => back(to));
  if (inTelegram) return null;
  return (
    <div class="devbar">
      <button type="button" class="textbtn" onClick={() => back(to)} style="display:flex;align-items:center;gap:2px;padding:0 4px">
        <Icon name="back" size={22} stroke={2.2} class="rtl-flip" />
        {t("common.back")}
      </button>
    </div>
  );
}

/**
 * Bottom actions. Inside Telegram these are the native MainButton / SecondaryButton;
 * otherwise (or when SecondaryButton isn't supported) plain buttons are rendered.
 */
export function BottomButtons({ main, secondary }: { main: ButtonSpec | null; secondary?: ButtonSpec | null }) {
  const native = useBottomButtons(main, secondary ?? null);
  const htmlMain = !native && main;
  const htmlSecondary = secondary && (!native || !hasSecondaryButton);
  if (!htmlMain && !htmlSecondary) return null;
  return (
    <div class="bottom">
      {htmlSecondary ? (
        <button type="button" class="btn soft" onClick={secondary!.onClick} disabled={secondary!.disabled}>
          {secondary!.text}
        </button>
      ) : null}
      {htmlMain ? (
        <button type="button" class="btn" onClick={main!.onClick} disabled={main!.disabled || main!.progress}>
          {main!.progress ? "…" : main!.text}
        </button>
      ) : null}
    </div>
  );
}
