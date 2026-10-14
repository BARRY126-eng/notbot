// Owner-only admin panel (English). The server checks the owner's Telegram ID on every /api/admin call.
import { useEffect, useState } from "preact/hooks";
import { platformName } from "../../shared/platforms";
import { api, clearApiCache } from "../api";
import { dateTime, money, num } from "../format";
import { Icon, StarIcon, type IconName } from "../icons";
import { enc, navigate } from "../router";
import { confirmDialog, haptic } from "../tg";
import { BackNav, BottomButtons, ErrorState, PlatformLogo, Row, Seg, Sheet, Skeleton, StatusPill, Switch, errText, toast, useAsync } from "../ui";
import type { OrderView } from "../../shared/types";

export function AdminRoutes({ parts, query }: { parts: string[]; query: URLSearchParams }) {
  const [a, b, c] = parts;
  if (!a) return <AdminHome />;
  if (a === "prices" && b && c) return <AdminCategory platform={b} category={c} />;
  if (a === "prices" && b) return <AdminPlatform platform={b} />;
  if (a === "prices") return <AdminPrices q={query.get("q") ?? ""} />;
  if (a === "changes") return <AdminChanges />;
  if (a === "payments") return <AdminPayments />;
  if (a === "users") return <AdminUsers />;
  if (a === "orders") return <AdminOrders />;
  if (a === "settings") return <AdminSettings />;
  return <AdminHome />;
}

const pct = (n: number) => `+${+n.toFixed(1)}%`;

function Page({ back, title, sub, children, bottom }: { back: string; title: string; sub?: string; children: preact.ComponentChildren; bottom?: boolean }) {
  return (
    <>
      <BackNav to={back} />
      <div class="screen no-tabs" style={bottom ? "padding-bottom:calc(110px + var(--safe-bottom))" : undefined}>
        <div>
          <h1 class="sm">{title}</h1>
          {sub ? <span class="sub">{sub}</span> : null}
        </div>
        {children}
      </div>
    </>
  );
}

function Loader<T>({ res, children }: { res: ReturnType<typeof useAsync<T>>; children: (d: T) => preact.ComponentChildren }) {
  if (res.error) return <ErrorState error={res.error} onRetry={res.reload} />;
  if (res.data === undefined) return <Skeleton h={50} n={4} />;
  return <>{children(res.data)}</>;
}

/** Markup stepper used for default, platform, category and service markups */
function MarkupEditor({ value, onChange, presets = [20, 30, 50, 100] }: { value: number; onChange: (n: number) => void; presets?: number[] }) {
  const set = (n: number) => {
    haptic.select();
    onChange(Math.max(0, Math.min(1000, Math.round(n))));
  };
  return (
    <div class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;align-items:center;gap:8px">
        <button type="button" class="iconbtn lg" aria-label="Lower markup" style="color:var(--fg)" onClick={() => set(value - 5)}>
          <Icon name="minus" size={20} stroke={2.4} />
        </button>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center">
          <input
            class="display"
            aria-label="Markup percent"
            inputMode="decimal"
            value={String(value)}
            onInput={(e) => onChange(Math.max(0, Math.min(1000, Number(e.currentTarget.value.replace(/[^\d.]/g, "")) || 0)))}
            style="width:120px;border:0;outline:0;background:transparent;text-align:center;font-size:30px"
          />
          <span class="sub" style="font-size:13px">% on top of NotPanel prices</span>
        </div>
        <button type="button" class="iconbtn lg" aria-label="Raise markup" style="color:var(--fg)" onClick={() => set(value + 5)}>
          <Icon name="plus" size={20} stroke={2.4} />
        </button>
      </div>
      <div class="presets">
        {presets.map((p) => (
          <button type="button" class="preset" key={p} aria-pressed={value === p} onClick={() => set(p)}>
            {p}%
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------- Home ----------------

interface Overview {
  npBalance: number | null;
  npError: string | null;
  lowBalance: number;
  today: { orders: number; sales: number; profit: number };
  users: number;
  openOrders: number;
  needsAttention: number;
  defaultMarkup: number;
  lastSync: { at: number; total: number; added: number; updated: number; removed: number; priceUp: number; priceDown: number; unchanged?: boolean; error?: string } | null;
}

function AdminHome() {
  const res = useAsync(() => api<Overview>("/admin/overview"), []);
  const rows: [string, IconName, string, string, string?][] = [
    ["Services & prices", "sliders", "var(--lavender-strong)", "/admin/prices"],
    ["Price changes", "chart", "var(--sky)", "/admin/changes"],
    ["Payments", "wallet", "var(--lime)", "/admin/payments"],
    ["Users", "users", "var(--pink)", "/admin/users"],
    ["All orders", "list", "var(--sky)", "/admin/orders"],
    ["Settings & connection", "plug", "var(--lavender)", "/admin/settings"],
  ];
  return (
    <Page back="/profile" title="Admin" sub="Only you can see this">
      <Loader res={res}>
        {(o) => (
          <>
            <div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;align-items:center;gap:10px">
                <img src="/brand/mark.svg" alt="" width={32} height={32} />
                <b style="flex:1">Your NotPanel account</b>
                <span class={`status ${o.npError ? "st-cancel" : "st-done"}`}>{o.npError ? "Error" : "Connected"}</span>
              </div>
              <div style="display:flex;align-items:flex-end;justify-content:space-between">
                <div>
                  <span class="sub" style="font-size:13px">NotPanel balance</span>
                  <b class="display" style="display:block;font-size:30px">{o.npBalance !== null ? money(o.npBalance) : "—"}</b>
                </div>
                <a class="chip sel" style="height:32px" href="https://notpanel.com/dashboard/wallet" target="_blank" rel="noopener">
                  Top up <Icon name="out" size={14} stroke={2.2} />
                </a>
              </div>
              {o.npError ? <div class="err-box">{o.npError}</div> : null}
              {o.npBalance !== null && o.npBalance < o.lowBalance ? (
                <div class="warn-box">Low balance: orders will fail when your NotPanel balance runs out.</div>
              ) : (
                <span class="sub" style="font-size:13px">Every order is paid from this balance.</span>
              )}
            </div>

            <div class="section">
              <h2 class="label">Today</h2>
              <div class="grid3">
                <div class="stat">
                  <span class="sub" style="font-size:13px">Orders</span>
                  <b>{num(o.today.orders)}</b>
                </div>
                <div class="stat">
                  <span class="sub" style="font-size:13px">Sales</span>
                  <b>{money(o.today.sales)}</b>
                </div>
                <div class="stat">
                  <span class="sub" style="font-size:13px">Profit</span>
                  <b style="color:var(--ok)">{money(o.today.profit)}</b>
                </div>
              </div>
            </div>

            {o.needsAttention ? (
              <button type="button" class="warn-box" style="border:0;text-align:start" onClick={() => navigate("/admin/prices?q=attention")}>
                {o.needsAttention} service(s) have a fixed price below NotPanel's cost and are hidden. Tap to review.
              </button>
            ) : null}

            <div class="section">
              <h2 class="label">Manage</h2>
              <div class="card">
                {rows.map(([title, icon, plate, href]) => (
                  <Row
                    key={href}
                    icon={icon}
                    plate={plate}
                    title={title}
                    href={href}
                    value={href === "/admin/prices" ? pct(o.defaultMarkup) : href === "/admin/users" ? num(o.users) : href === "/admin/orders" && o.openOrders ? `${o.openOrders} open` : undefined}
                  />
                ))}
              </div>
              {o.lastSync ? (
                <p class="note" style="margin:0">
                  Last price sync {dateTime(o.lastSync.at)}
                  {o.lastSync.error ? ` · failed: ${o.lastSync.error}` : o.lastSync.unchanged ? " · no changes" : ` · ${o.lastSync.total} services, ${o.lastSync.priceUp}↑ ${o.lastSync.priceDown}↓`}
                </p>
              ) : null}
            </div>
          </>
        )}
      </Loader>
    </Page>
  );
}

// ---------------- Prices ----------------

interface AdminPlatformRow {
  slug: string;
  name: string;
  count: number;
  enabledServices: number;
  enabled: boolean;
  markupPct: number | null;
}
interface AdminServiceRow {
  id: number;
  name: string;
  customName: string | null;
  platform: string;
  category: string;
  cost: number;
  prevCost: number | null;
  sell: number;
  markup: number;
  markupPct: number | null;
  fixedRate: number | null;
  min: number;
  max: number;
  enabled: boolean;
}

function invalidate() {
  clearApiCache();
}

function AdminPrices({ q: initialQ }: { q: string }) {
  const settings = useAsync(() => api<{ default_markup_pct: number }>("/admin/settings"), []);
  const platforms = useAsync(() => api<AdminPlatformRow[]>("/admin/platforms"), []);
  const [markup, setMarkup] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState(initialQ === "attention" ? "" : initialQ);
  const attention = initialQ === "attention";
  const [results, setResults] = useState<AdminServiceRow[] | null>(null);
  const [edit, setEdit] = useState<AdminServiceRow | null>(null);

  useEffect(() => {
    if (settings.data) setMarkup(settings.data.default_markup_pct);
  }, [settings.data]);
  const search = () =>
    api<AdminServiceRow[]>(attention ? "/admin/services?attention=1" : `/admin/services?q=${enc(q.trim())}`).then(setResults, (e) => toast(errText(e)));
  useEffect(() => {
    if (attention) return void search();
    if (q.trim().length < 2) return setResults(null);
    const id = setTimeout(search, 300);
    return () => clearTimeout(id);
  }, [q]);

  const dirty = markup !== null && settings.data && markup !== settings.data.default_markup_pct;
  const save = async () => {
    setSaving(true);
    try {
      await api("/admin/settings", { method: "PUT", body: { default_markup_pct: markup } });
      haptic.success();
      invalidate();
      settings.reload();
      toast("Default markup saved");
    } catch (e) {
      toast(errText(e));
    }
    setSaving(false);
  };

  return (
    <Page back="/admin" title="Services & prices" sub="Sell price = NotPanel cost + markup" bottom={!!dirty}>
      {!attention ? (
        <div class="section">
          <h2 class="label">Default markup</h2>
          {markup !== null ? <MarkupEditor value={markup} onChange={setMarkup} /> : <Skeleton h={120} />}
          <p class="note" style="margin:0">Used unless a platform, category or service has its own markup or a fixed price.</p>
        </div>
      ) : null}

      {!attention ? (
        <label class="search">
          <Icon name="search" size={18} stroke={2} />
          <input type="search" placeholder="Find a service by name or ID" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        </label>
      ) : null}

      {results ? (
        <AdminServiceList items={results} onEdit={setEdit} onChanged={search} />
      ) : (
        <div class="section">
          <h2 class="label">Platforms</h2>
          <div class="card">
            <Loader res={platforms}>
              {(list) =>
                list.map((p) => (
                  <Row
                    key={p.slug}
                    lead={<PlatformLogo slug={p.slug} size={34} radius={10} />}
                    title={p.name}
                    meta={`${p.enabledServices} of ${p.count} on sale${p.enabled ? "" : " · hidden"}`}
                    value={p.markupPct !== null ? pct(p.markupPct) : undefined}
                    href={`/admin/prices/${enc(p.slug)}`}
                  />
                ))
              }
            </Loader>
          </div>
        </div>
      )}
      {edit ? <ServiceEditSheet s={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), search())} /> : null}
      <BottomButtons main={dirty ? { text: `Save markup ${pct(markup!)}`, onClick: save, progress: saving } : null} />
    </Page>
  );
}

function RuleCard({ platform, category, enabled, markupPct, defaultMarkup, onSaved }: { platform: string; category?: string; enabled: boolean; markupPct: number | null; defaultMarkup: number; onSaved: () => void }) {
  const [own, setOwn] = useState(markupPct !== null);
  const [value, setValue] = useState(markupPct ?? defaultMarkup);
  const [busy, setBusy] = useState(false);
  const save = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await api("/admin/rule", { method: "PUT", body: { platform, category: category ?? "", ...body } });
      invalidate();
      haptic.success();
      onSaved();
    } catch (e) {
      toast(errText(e));
    }
    setBusy(false);
  };
  const what = category ? "category" : "platform";
  return (
    <div class="section">
      <div class="card">
        <Row title={`Show this ${what}`} meta={enabled ? "Customers can order from it" : "Hidden from customers"} chevron={false}>
          <Switch on={enabled} label={`Show this ${what}`} disabled={busy} onChange={(v) => save({ enabled: v })} />
        </Row>
        <Row title="Own markup" meta={own ? `Overrides the ${category ? "platform/default" : "default"} markup` : "Uses the default markup"} chevron={false}>
          <Switch
            on={own}
            label="Own markup"
            disabled={busy}
            onChange={(v) => {
              setOwn(v);
              if (!v) save({ markupPct: null });
            }}
          />
        </Row>
      </div>
      {own ? (
        <>
          <MarkupEditor value={value} onChange={setValue} />
          <button type="button" class="btn sm" disabled={busy} onClick={() => save({ markupPct: value })}>
            Save {what} markup {pct(value)}
          </button>
        </>
      ) : null}
    </div>
  );
}

function AdminPlatform({ platform }: { platform: string }) {
  const settings = useAsync(() => api<{ default_markup_pct: number }>("/admin/settings"), []);
  const platforms = useAsync(() => api<AdminPlatformRow[]>("/admin/platforms"), []);
  const cats = useAsync(() => api<{ name: string; count: number; enabledServices: number; enabled: boolean; markupPct: number | null }[]>(`/admin/categories?platform=${enc(platform)}`), [platform]);
  const p = platforms.data?.find((x) => x.slug === platform);
  return (
    <Page back="/admin/prices" title={platformName(platform)} sub="Platform rules apply to all its categories">
      {p && settings.data ? (
        <RuleCard key={`${p.enabled}-${p.markupPct}`} platform={platform} enabled={p.enabled} markupPct={p.markupPct} defaultMarkup={settings.data.default_markup_pct} onSaved={platforms.reload} />
      ) : (
        <Skeleton h={100} />
      )}
      <div class="section">
        <h2 class="label">Categories</h2>
        <div class="card">
          <Loader res={cats}>
            {(list) =>
              list.map((c) => (
                <Row
                  key={c.name}
                  title={c.name}
                  meta={`${c.enabledServices} of ${c.count} on sale${c.enabled ? "" : " · hidden"}`}
                  value={c.markupPct !== null ? pct(c.markupPct) : undefined}
                  href={`/admin/prices/${enc(platform)}/${enc(c.name)}`}
                />
              ))
            }
          </Loader>
        </div>
      </div>
    </Page>
  );
}

function AdminCategory({ platform, category }: { platform: string; category: string }) {
  const settings = useAsync(() => api<{ default_markup_pct: number }>("/admin/settings"), []);
  const cats = useAsync(() => api<{ name: string; enabled: boolean; markupPct: number | null }[]>(`/admin/categories?platform=${enc(platform)}`), [platform]);
  const services = useAsync(() => api<AdminServiceRow[]>(`/admin/services?platform=${enc(platform)}&category=${enc(category)}`), [platform, category]);
  const [edit, setEdit] = useState<AdminServiceRow | null>(null);
  const c = cats.data?.find((x) => x.name === category);
  return (
    <Page back={`/admin/prices/${enc(platform)}`} title={category} sub={platformName(platform)}>
      {c && settings.data ? (
        <RuleCard
          key={`${c.enabled}-${c.markupPct}`}
          platform={platform}
          category={category}
          enabled={c.enabled}
          markupPct={c.markupPct}
          defaultMarkup={settings.data.default_markup_pct}
          onSaved={() => (cats.reload(), services.reload())}
        />
      ) : (
        <Skeleton h={100} />
      )}
      <div class="section">
        <h2 class="label">Services</h2>
        <Loader res={services}>{(list) => <AdminServiceList items={list} onEdit={setEdit} onChanged={services.reload} />}</Loader>
        <p class="note" style="margin:0">Tap a service to rename it or give it its own price.</p>
      </div>
      {edit ? <ServiceEditSheet s={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), services.reload())} /> : null}
    </Page>
  );
}

function priceDiff(s: AdminServiceRow) {
  if (s.prevCost === null || s.prevCost === s.cost) return null;
  const up = s.cost > s.prevCost;
  const d = ((s.cost - s.prevCost) / s.prevCost) * 100;
  return (
    <span style={`color:${up ? "var(--st-cancel)" : "var(--ok)"};font-weight:600`}>
      {up ? "↑" : "↓"}
      {Math.abs(d).toFixed(1)}%
    </span>
  );
}

function AdminServiceList({ items, onEdit, onChanged }: { items: AdminServiceRow[]; onEdit: (s: AdminServiceRow) => void; onChanged: () => void }) {
  const toggle = async (s: AdminServiceRow, on: boolean) => {
    try {
      await api(`/admin/services/${s.id}`, { method: "PUT", body: { enabled: on } });
      invalidate();
      onChanged();
    } catch (e) {
      toast(errText(e));
    }
  };
  if (!items.length) return <div class="empty">No services</div>;
  return (
    <div class="card">
      {items.map((s) => (
        <button type="button" class="row" key={s.id} onClick={() => (haptic.tap(), onEdit(s))}>
          <span class="body" style="min-height:62px">
            <span class="grow" style="gap:2px">
              <span class="t15 ellipsis">{s.customName ?? s.name}</span>
              <span class="meta">
                #{s.id} · Costs {money(s.cost)} {priceDiff(s)} · Sells <b style="color:var(--sel-fg)">{money(s.sell)}</b>
                {s.fixedRate !== null ? " (fixed)" : s.markupPct !== null ? ` (${pct(s.markupPct)})` : ""}
              </span>
              {s.fixedRate !== null && s.fixedRate < s.cost ? <span class="meta" style="color:var(--destructive)">Below cost: hidden</span> : null}
            </span>
            <Switch on={s.enabled} label={`Sell ${s.name}`} onChange={(v) => toggle(s, v)} />
          </span>
        </button>
      ))}
    </div>
  );
}

function ServiceEditSheet({ s, onClose, onSaved }: { s: AdminServiceRow; onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"inherit" | "markup" | "fixed">(s.fixedRate !== null ? "fixed" : s.markupPct !== null ? "markup" : "inherit");
  const [markup, setMarkup] = useState(s.markupPct ?? s.markup);
  const [fixed, setFixed] = useState(((s.fixedRate ?? s.sell) / 1e6).toString());
  const [name, setName] = useState(s.customName ?? "");
  const [busy, setBusy] = useState(false);
  const fixedMicro = Math.round(Number(fixed) * 1e6);
  const preview = mode === "fixed" ? fixedMicro : mode === "markup" ? Math.ceil((s.cost * (1 + markup / 100)) / 100) * 100 : null;
  const save = async () => {
    setBusy(true);
    try {
      await api(`/admin/services/${s.id}`, {
        method: "PUT",
        body: {
          customName: name.trim() || null,
          markupPct: mode === "markup" ? markup : null,
          fixedRate: mode === "fixed" ? fixedMicro : null,
        },
      });
      invalidate();
      haptic.success();
      onSaved();
    } catch (e) {
      toast(errText(e));
      setBusy(false);
    }
  };
  return (
    <Sheet title={`Service #${s.id}`} sub={s.name} onClose={onClose}>
      <div style="display:flex;flex-direction:column;gap:12px;padding-bottom:8px">
        <div class="card">
          <div class="kv">
            <dt>NotPanel cost</dt>
            <dd>
              {money(s.cost)} / 1K {priceDiff(s)}
            </dd>
          </div>
          <div class="kv">
            <dt>Sells now</dt>
            <dd style="font-weight:600">{money(s.sell)} / 1K</dd>
          </div>
        </div>
        <div class="section">
          <h2 class="label">Name shown to customers</h2>
          <div class="card field">
            <input placeholder={s.name} value={name} onInput={(e) => setName(e.currentTarget.value)} />
          </div>
        </div>
        <div class="section">
          <h2 class="label">Price</h2>
          <Seg
            label="Price"
            value={mode}
            onChange={setMode}
            options={[
              ["inherit", "Default"],
              ["markup", "Own markup"],
              ["fixed", "Fixed price"],
            ]}
          />
          {mode === "markup" ? <MarkupEditor value={markup} onChange={setMarkup} /> : null}
          {mode === "fixed" ? (
            <div class="card field">
              <span class="display" style="font-size:22px">$</span>
              <input inputMode="decimal" class="display" style="font-size:22px" value={fixed} onInput={(e) => setFixed(e.currentTarget.value.replace(/[^\d.]/g, ""))} />
              <span class="sub" style="padding-inline-end:10px">per 1K</span>
            </div>
          ) : null}
          {preview !== null ? (
            <p class="note" style="margin:0">
              New price {money(preview)} / 1K · profit {money(preview - s.cost)} per 1K
              {preview < s.cost ? " · below cost, the service will be hidden" : ""}
            </p>
          ) : null}
        </div>
        <button type="button" class="btn" disabled={busy || (mode === "fixed" && !(fixedMicro > 0))} onClick={save}>
          Save
        </button>
      </div>
    </Sheet>
  );
}

// ---------------- Price changes ----------------

function AdminChanges() {
  const res = useAsync(() => api<{ id: number; service_id: number; old_rate: number; new_rate: number; changed_at: number; name: string | null; platform: string | null; category: string | null }[]>("/admin/price-changes"), []);
  return (
    <Page back="/admin" title="Price changes" sub="NotPanel cost changes found by the automatic sync">
      <div class="card">
        <Loader res={res}>
          {(list) =>
            list.length ? (
              list.map((c) => {
                const up = c.new_rate > c.old_rate;
                const d = c.old_rate ? ((c.new_rate - c.old_rate) / c.old_rate) * 100 : 0;
                return (
                  <Row
                    key={c.id}
                    lead={c.platform ? <PlatformLogo slug={c.platform} size={34} radius={10} /> : undefined}
                    title={c.name ?? `#${c.service_id}`}
                    meta={`#${c.service_id} · ${money(c.old_rate)} → ${money(c.new_rate)} · ${dateTime(c.changed_at)}`}
                    value={<span style={`font-weight:600;color:${up ? "var(--st-cancel)" : "var(--ok)"}`}>{`${up ? "+" : ""}${d.toFixed(1)}%`}</span>}
                    chevron={false}
                  />
                );
              })
            ) : (
              <div class="empty">No price changes yet. They appear here after each sync.</div>
            )
          }
        </Loader>
      </div>
    </Page>
  );
}

// ---------------- Payments ----------------

interface PaymentRow {
  id: number;
  user_id: number;
  stars: number;
  amount: number;
  status: string;
  order_id: number | null;
  paid_at: number | null;
  first_name: string | null;
  username: string | null;
}

function AdminPayments() {
  const res = useAsync(() => api<{ items: PaymentRow[]; totals: { stars: number; amount: number } }>("/admin/payments"), []);
  const refund = async (p: PaymentRow) => {
    const ok = await confirmDialog(`Refund ${num(p.stars)} Stars to ${p.first_name ?? p.user_id}? ${money(p.amount)} is taken from their balance.`, "Refund", "Cancel", true);
    if (!ok) return;
    try {
      await api(`/admin/payments/${p.id}/refund`, { method: "POST" });
      haptic.success();
      toast("Refunded");
      res.reload();
    } catch (e) {
      toast(errText(e));
    }
  };
  return (
    <Page back="/admin" title="Payments" sub="Telegram Stars">
      <Loader res={res}>
        {(d) => (
          <>
            <div class="grid3" style="grid-template-columns:1fr 1fr">
              <div class="stat">
                <span class="sub" style="font-size:13px">Stars received</span>
                <b style="display:flex;align-items:center;gap:6px">
                  <StarIcon size={18} />
                  {num(d.totals.stars)}
                </b>
              </div>
              <div class="stat">
                <span class="sub" style="font-size:13px">Balance sold</span>
                <b>{money(d.totals.amount)}</b>
              </div>
            </div>
            <div class="card">
              {d.items.length ? (
                d.items.map((p) => (
                  <Row
                    key={p.id}
                    title={`${p.first_name ?? p.user_id}${p.username ? ` @${p.username}` : ""}`}
                    meta={`${num(p.stars)} ⭐ · ${money(p.amount)}${p.order_id ? ` · order #${p.order_id}` : ""} · ${p.paid_at ? dateTime(p.paid_at) : ""}`}
                    chevron={false}
                  >
                    {p.status === "paid" ? (
                      <button type="button" class="chip" style="border:0;height:30px" onClick={() => refund(p)}>
                        Refund
                      </button>
                    ) : (
                      <span class="status st-cancel">Refunded</span>
                    )}
                  </Row>
                ))
              ) : (
                <div class="empty">No payments yet.</div>
              )}
            </div>
            <p class="note" style="margin:0">A refund is possible while the user still has that much unspent balance.</p>
          </>
        )}
      </Loader>
    </Page>
  );
}

// ---------------- Users ----------------

interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  username: string | null;
  balance: number;
  banned: number;
  orders: number;
  paid: number;
  last_seen_at: number;
}

function AdminUsers() {
  const [q, setQ] = useState("");
  const [list, setList] = useState<UserRow[] | null>(null);
  const [sel, setSel] = useState<UserRow | null>(null);
  const load = () => api<UserRow[]>(`/admin/users?q=${enc(q.trim())}`).then(setList, (e) => toast(errText(e)));
  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [q]);
  return (
    <Page back="/admin" title="Users">
      <label class="search">
        <Icon name="search" size={18} stroke={2} />
        <input type="search" placeholder="Name, @username or Telegram ID" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </label>
      <div class="card">
        {!list ? (
          <Skeleton h={54} n={4} />
        ) : list.length ? (
          list.map((u) => (
            <Row
              key={u.id}
              title={`${u.first_name} ${u.last_name}`.trim() || String(u.id)}
              meta={`${u.username ? "@" + u.username + " · " : ""}${u.id} · ${u.orders} orders · paid ${money(u.paid)}${u.banned ? " · blocked" : ""}`}
              value={money(u.balance)}
              onClick={() => setSel(u)}
            />
          ))
        ) : (
          <div class="empty">No users found</div>
        )}
      </div>
      {sel ? <UserSheet u={sel} onClose={() => setSel(null)} onSaved={() => (setSel(null), load())} /> : null}
    </Page>
  );
}

function UserSheet({ u, onClose, onSaved }: { u: UserRow; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const adjust = async (sign: 1 | -1) => {
    const v = Number(amount);
    if (!(v > 0)) return;
    setBusy(true);
    try {
      await api(`/admin/users/${u.id}/balance`, { body: { amount: sign * v, note: "admin" } });
      haptic.success();
      onSaved();
    } catch (e) {
      toast(errText(e));
      setBusy(false);
    }
  };
  const ban = async (banned: boolean) => {
    try {
      await api(`/admin/users/${u.id}/ban`, { body: { banned } });
      onSaved();
    } catch (e) {
      toast(errText(e));
    }
  };
  return (
    <Sheet title={`${u.first_name} ${u.last_name}`.trim()} sub={`${u.username ? "@" + u.username + " · " : ""}ID ${u.id}`} onClose={onClose}>
      <div style="display:flex;flex-direction:column;gap:12px;padding-bottom:8px">
        <dl class="card">
          <div class="kv">
            <dt>Balance</dt>
            <dd style="font-weight:600">{money(u.balance)}</dd>
          </div>
          <div class="kv">
            <dt>Orders</dt>
            <dd>{u.orders}</dd>
          </div>
          <div class="kv">
            <dt>Paid with Stars</dt>
            <dd>{money(u.paid)}</dd>
          </div>
          <div class="kv">
            <dt>Last seen</dt>
            <dd>{dateTime(u.last_seen_at)}</dd>
          </div>
        </dl>
        <div class="section">
          <h2 class="label">Adjust balance (USD)</h2>
          <div class="card field">
            <span>$</span>
            <input inputMode="decimal" placeholder="0.00" value={amount} onInput={(e) => setAmount(e.currentTarget.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn sm danger" disabled={busy} onClick={() => adjust(-1)}>
              Remove
            </button>
            <button type="button" class="btn sm" disabled={busy} onClick={() => adjust(1)}>
              Add
            </button>
          </div>
        </div>
        <div class="card">
          <Row title="Block this user" meta="Blocked users can't open the app" chevron={false}>
            <Switch on={!!u.banned} label="Block this user" onChange={ban} />
          </Row>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------- Orders ----------------

type AdminOrder = OrderView & { npOrderId: number | null; cost: number | null; userId: number; userName: string; username: string | null; error: string | null };

function AdminOrders() {
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [list, setList] = useState<AdminOrder[] | null>(null);
  useEffect(() => {
    const id = setTimeout(() => api<AdminOrder[]>(`/admin/orders?status=${status}&q=${enc(q.trim())}`).then(setList, (e) => toast(errText(e))), q ? 300 : 0);
    return () => clearTimeout(id);
  }, [status, q]);
  const filters: [string, string][] = [
    ["", "All"],
    ["open", "Open"],
    ["completed", "Completed"],
    ["partial", "Partial"],
    ["cancelled", "Canceled"],
    ["failed", "Failed"],
  ];
  return (
    <Page back="/admin" title="All orders">
      <div class="chips" style="flex-wrap:nowrap;overflow-x:auto;margin:0 -16px;padding:0 16px">
        {filters.map(([v, l]) => (
          <button type="button" key={v} class={`chip ${status === v ? "sel" : ""}`} style="border:0;height:34px" onClick={() => (haptic.select(), setList(null), setStatus(v))}>
            {l}
          </button>
        ))}
      </div>
      <label class="search">
        <Icon name="search" size={18} stroke={2} />
        <input type="search" placeholder="Order #, NotPanel #, user ID or link" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </label>
      <div class="card">
        {!list ? (
          <Skeleton h={62} n={4} />
        ) : list.length ? (
          list.map((o) => (
            <div class="row" key={o.id}>
              <PlatformLogo slug={o.platform} size={34} radius={10} />
              <span class="body" style="min-height:66px">
                <span class="grow" style="gap:2px">
                  <span class="t15 ellipsis">{o.serviceName}</span>
                  <span class="meta ellipsis">
                    #{o.id}
                    {o.npOrderId ? ` · NP ${o.npOrderId}` : ""} · {o.userName}
                    {o.username ? ` @${o.username}` : ""} · {num(o.quantity)}
                  </span>
                  <span class="meta">
                    Paid {money(o.charge - o.refund)} · cost {o.cost !== null ? money(o.cost) : "—"}
                    {o.cost !== null ? ` · profit ${money(o.charge - o.refund - o.cost)}` : ""}
                    {o.error ? ` · ${o.error}` : ""}
                  </span>
                </span>
                <StatusPill status={o.status} />
              </span>
            </div>
          ))
        ) : (
          <div class="empty">No orders</div>
        )}
      </div>
    </Page>
  );
}

// ---------------- Settings ----------------

interface AdminSettingsData {
  default_markup_pct: number;
  stars_per_usd: number;
  min_topup: number;
  max_topup: number;
  sync_enabled: number;
  sync_every_hours: number;
  auto_enable_new: number;
  only_timed: number;
  low_balance: number;
  support_username: string;
  terms_text: string;
  last_sync_at: number;
  last_sync_summary: Overview["lastSync"];
  sync: { running: boolean; page: number; totalPages: number };
  webhook_connected: boolean;
  app_url: string;
  bot_username: string;
  key_hint: string | null;
}

function AdminSettings() {
  const res = useAsync(() => api<AdminSettingsData>("/admin/settings"), []);
  const [draft, setDraft] = useState<Partial<AdminSettingsData>>({});
  const [busy, setBusy] = useState(false);
  const s = res.data ? { ...res.data, ...draft } : null;
  const dirty = Object.keys(draft).length > 0;

  // Watch a running sync
  useEffect(() => {
    if (!res.data?.sync.running) return;
    const id = setInterval(() => api<AdminSettingsData>("/admin/settings").then(res.set, () => undefined), 5000);
    return () => clearInterval(id);
  }, [res.data?.sync.running]);

  const set = <K extends keyof AdminSettingsData>(k: K, v: AdminSettingsData[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const save = async () => {
    setBusy(true);
    try {
      await api("/admin/settings", { method: "PUT", body: draft });
      haptic.success();
      invalidate();
      setDraft({});
      res.reload();
      toast("Saved");
    } catch (e) {
      toast(errText(e));
    }
    setBusy(false);
  };
  const syncNow = async () => {
    try {
      const r = await api<{ running: boolean }>("/admin/sync", { method: "POST" });
      toast(r.running ? "Sync started. It runs in the background for about 20 minutes." : "Sync queued");
      res.reload();
    } catch (e) {
      toast(errText(e));
    }
  };
  const reconnect = async () => {
    try {
      const r = await api<{ bot: string; notpanelWebhook: true | string }>("/admin/connect", { method: "POST" });
      toast(r.notpanelWebhook === true ? `Connected @${r.bot} and NotPanel updates` : `Bot connected; NotPanel webhook: ${r.notpanelWebhook}`);
      res.reload();
    } catch (e) {
      toast(errText(e));
    }
  };

  const usdField = (k: "min_topup" | "max_topup" | "low_balance", label: string) => (
    <div class="kv">
      <dt>{label}</dt>
      <dd style="display:flex;align-items:center;gap:2px">
        $
        <input
          inputMode="decimal"
          style="width:80px;border:0;outline:0;background:transparent;text-align:end;font-size:15px"
          value={String(s![k] / 1e6)}
          onInput={(e) => set(k, Math.round((Number(e.currentTarget.value.replace(/[^\d.]/g, "")) || 0) * 1e6))}
        />
      </dd>
    </div>
  );

  return (
    <Page back="/admin" title="Settings & connection" bottom={dirty}>
      {!s ? (
        res.error ? <ErrorState error={res.error} onRetry={res.reload} /> : <Skeleton h={50} n={6} />
      ) : (
        <>
          <div class="section">
            <h2 class="label">Telegram Stars</h2>
            <dl class="card">
              <div class="kv">
                <dt>Stars per $1 of balance</dt>
                <dd>
                  <input
                    inputMode="numeric"
                    style="width:70px;border:0;outline:0;background:transparent;text-align:end;font-size:15px"
                    value={String(s.stars_per_usd)}
                    onInput={(e) => set("stars_per_usd", Number(e.currentTarget.value.replace(/\D/g, "")) || 0)}
                  />
                </dd>
              </div>
              {usdField("min_topup", "Smallest top-up")}
              {usdField("max_topup", "Largest top-up")}
            </dl>
            <p class="note" style="margin:0">Telegram pays out roughly $0.013 per Star, so 77 Stars per $1 is about break-even. Your markup is the profit.</p>
          </div>

          <div class="section">
            <h2 class="label">Price sync</h2>
            <div class="card">
              <Row title="Update prices automatically" chevron={false}>
                <Switch on={!!s.sync_enabled} label="Update prices automatically" onChange={(v) => set("sync_enabled", v ? 1 : 0)} />
              </Row>
              <div class="row">
                <span class="body" style="flex-direction:column;align-items:stretch;gap:8px;padding-top:10px;padding-bottom:12px">
                  <span class="title">Every</span>
                  <Seg
                    label="Sync interval"
                    value={String(s.sync_every_hours)}
                    onChange={(v) => set("sync_every_hours", Number(v))}
                    options={[
                      ["1", "1 h"],
                      ["3", "3 h"],
                      ["6", "6 h"],
                      ["12", "12 h"],
                      ["24", "24 h"],
                    ]}
                  />
                </span>
              </div>
              <Row title="Only services with an average time" meta="Lists only services NotPanel has measured delivery times for" chevron={false}>
                <Switch on={!!s.only_timed} label="Only services with an average time" onChange={(v) => set("only_timed", v ? 1 : 0)} />
              </Row>
              <Row title="Put new services on sale" meta="Off: new NotPanel services arrive hidden" chevron={false}>
                <Switch on={!!s.auto_enable_new} label="Put new services on sale" onChange={(v) => set("auto_enable_new", v ? 1 : 0)} />
              </Row>
              <Row
                title={s.sync.running ? `Syncing… page ${s.sync.page} of ${s.sync.totalPages || "?"}` : "Sync now"}
                meta={s.last_sync_at ? `Last: ${dateTime(s.last_sync_at)}${s.last_sync_summary?.error ? " · failed" : s.last_sync_summary?.unchanged ? " · no changes" : s.last_sync_summary ? ` · ${s.last_sync_summary.total} services` : ""}` : "Never synced"}
                accent={!s.sync.running}
                onClick={s.sync.running ? undefined : syncNow}
                chevron={false}
              />
            </div>
            {s.last_sync_summary?.error ? <div class="err-box">{s.last_sync_summary.error}</div> : null}
          </div>

          <div class="section">
            <h2 class="label">Alerts & support</h2>
            <dl class="card">
              {usdField("low_balance", "Warn when NotPanel balance is below")}
              <div class="kv">
                <dt>Support username</dt>
                <dd style="display:flex;align-items:center">
                  @
                  <input
                    style="width:140px;border:0;outline:0;background:transparent;font-size:15px"
                    value={s.support_username}
                    placeholder="your_support"
                    onInput={(e) => set("support_username", e.currentTarget.value.replace(/^@/, ""))}
                  />
                </dd>
              </div>
            </dl>
          </div>

          <div class="section">
            <h2 class="label">Terms of service</h2>
            <div class="card field top">
              <textarea rows={6} value={s.terms_text} onInput={(e) => set("terms_text", e.currentTarget.value)} />
            </div>
            <p class="note" style="margin:0">Shown in the app and by /terms. Telegram requires terms for Stars payments.</p>
          </div>

          <div class="section">
            <h2 class="label">Connection</h2>
            <dl class="card">
              <div class="kv">
                <dt>NotPanel API key</dt>
                <dd style="font-family:ui-monospace,monospace">{s.key_hint ?? "missing"}</dd>
              </div>
              <div class="kv">
                <dt>Bot</dt>
                <dd>{s.bot_username ? `@${s.bot_username}` : "not connected"}</dd>
              </div>
              <div class="kv">
                <dt>Instant order updates</dt>
                <dd>{s.webhook_connected ? "On" : "Off (checked every minute instead)"}</dd>
              </div>
              <div class="kv">
                <dt>Mini App URL</dt>
                <dd class="ellipsis" style="font-family:ui-monospace,monospace;font-size:13px">{s.app_url || "—"}</dd>
              </div>
            </dl>
            <button type="button" class="btn soft sm" onClick={reconnect}>
              Reconnect bot & NotPanel updates
            </button>
            <p class="note" style="margin:0">The API key is stored as a Cloudflare secret. To replace it, run: npx wrangler secret put NOTPANEL_API_KEY</p>
          </div>
        </>
      )}
      <BottomButtons main={dirty ? { text: "Save", onClick: save, progress: busy } : null} />
    </Page>
  );
}
