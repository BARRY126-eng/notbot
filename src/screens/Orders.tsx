import { useEffect, useState } from "preact/hooks";
import type { OrderView } from "../../shared/types";
import { api } from "../api";
import { dayKey, dayLabel, money, num, prettyLink } from "../format";
import { t } from "../i18n";
import { Icon } from "../icons";
import { enc, navigate } from "../router";
import { haptic } from "../tg";
import { ErrorState, PlatformLogo, Seg, Skeleton, StatusPill } from "../ui";

type Filter = "all" | "active" | "finished";

export function OrderRow({ o, first }: { o: OrderView; first?: boolean }) {
  const active = o.status === "in_progress" || o.status === "processing";
  const done = o.remains !== null ? Math.max(0, o.quantity - o.remains) : null;
  return (
    <button type="button" class={`row ${first ? "first" : ""}`} onClick={() => (haptic.tap(), navigate(`/order/${o.id}`))}>
      <PlatformLogo slug={o.platform} size={36} radius={10} />
      <span class="body" style="min-height:62px;align-items:center">
        <span class="grow" style="gap:3px">
          <span class="t15 ellipsis">{o.serviceName}</span>
          <span class="meta ellipsis">
            #{o.id} · {num(o.quantity)} · {o.status === "cancelled" || o.status === "failed" ? t("orders.refunded") : money(o.charge - o.refund)}
          </span>
          {active && done !== null ? (
            <span style="display:flex;align-items:center;gap:8px;margin-top:3px">
              <span class="bar" style="flex:1">
                <i style={`width:${Math.min(100, (done / o.quantity) * 100)}%`} />
              </span>
              <span style="font-size:12px;color:var(--hint)">{t("orders.progress", { done: num(done), total: num(o.quantity) })}</span>
            </span>
          ) : (
            <span class="meta ellipsis" style="font-size:12px">{prettyLink(o.link)}</span>
          )}
        </span>
        <StatusPill status={o.status} />
      </span>
    </button>
  );
}

export function Orders() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<OrderView[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [more, setMore] = useState(false);

  const load = async (before?: number) => {
    setError(null);
    try {
      const list = await api<OrderView[]>(`/orders?filter=${filter}&q=${enc(q.trim())}${before ? `&before=${before}` : ""}`);
      setItems((prev) => (before && prev ? [...prev, ...list] : list));
      setMore(list.length === 30);
    } catch (e) {
      setError(e);
    }
  };
  useEffect(() => {
    const id = setTimeout(() => load(), q ? 300 : 0);
    return () => clearTimeout(id);
  }, [filter, q]);

  // Group by day
  const groups: { label: string; items: OrderView[] }[] = [];
  for (const o of items ?? []) {
    const k = dayKey(o.createdAt);
    const g = groups[groups.length - 1];
    if (g && (g as any).k === k) g.items.push(o);
    else groups.push(Object.assign({ label: dayLabel(o.createdAt, t("common.today"), t("common.yesterday")), items: [o] }, { k }));
  }

  return (
    <div class="screen">
      <h1 style="margin-top:6px">{t("orders.title")}</h1>
      <Seg
        label={t("orders.title")}
        value={filter}
        onChange={(f) => {
          setItems(null);
          setFilter(f);
        }}
        options={[
          ["all", t("orders.all")],
          ["active", t("orders.active")],
          ["finished", t("orders.finished")],
        ]}
      />
      <label class="search">
        <Icon name="search" size={18} stroke={2} />
        <span class="sr">{t("orders.search")}</span>
        <input type="search" placeholder={t("orders.search")} value={q} onInput={(e) => setQ(e.currentTarget.value)} />
      </label>
      {error ? (
        <ErrorState error={error} onRetry={() => load()} />
      ) : !items ? (
        <Skeleton h={62} n={4} />
      ) : !items.length ? (
        <div class="empty">
          <span class="tile" style="width:56px;height:56px;border-radius:18px;background:var(--sky)">
            <Icon name="receipt" size={28} stroke={1.6} />
          </span>
          <b>{t("orders.empty")}</b>
          <span>{t("orders.emptySub")}</span>
          {!q && filter === "all" ? (
            <button type="button" class="btn sm" style="flex:none;padding:0 18px" onClick={() => navigate("/", { replace: true })}>
              {t("orders.start")}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          {groups.map((g) => (
            <div class="section" key={g.label}>
              <h2 class="label">{g.label}</h2>
              <div class="card">
                {g.items.map((o, i) => (
                  <OrderRow key={o.id} o={o} first={i === 0} />
                ))}
              </div>
            </div>
          ))}
          {more ? (
            <button type="button" class="btn soft sm" onClick={() => load(items[items.length - 1].id)}>
              {t("common.showMore")}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
