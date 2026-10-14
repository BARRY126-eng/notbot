import { useEffect, useState } from "preact/hooks";
import type { PlatformItem, ServiceItem } from "../../shared/types";
import { api, cachedApi } from "../api";
import { money, num, prettyLink } from "../format";
import { t } from "../i18n";
import { Icon } from "../icons";
import { enc, navigate } from "../router";
import { meStore } from "../store";
import { haptic } from "../tg";
import { ErrorState, PlatformLogo, Skeleton, useAsync } from "../ui";
import { platformName } from "../../shared/platforms";
import { ServiceRows } from "./Services";

export function PlatformGrid({ items, current, onPick }: { items: PlatformItem[]; current?: string; onPick: (slug: string) => void }) {
  return (
    <div class="grid5">
      {items.map((p) => (
        <button
          type="button"
          class="ptile"
          key={p.slug}
          onClick={() => {
            haptic.tap();
            onPick(p.slug);
          }}
        >
          <PlatformLogo slug={p.slug} size={48} radius={14} on={current === p.slug} />
          <span>{p.name}</span>
        </button>
      ))}
    </div>
  );
}

export function Home() {
  const me = meStore.use()!;
  const platforms = useAsync(() => cachedApi<PlatformItem[]>("/catalog/platforms"), []);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ServiceItem[] | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2 && !/^\d+$/.test(term)) {
      setResults(null);
      return;
    }
    const id = setTimeout(() => api<ServiceItem[]>(`/catalog/search?q=${enc(term)}`).then(setResults, () => setResults([])), 250);
    return () => clearTimeout(id);
  }, [q]);

  return (
    <div class="screen">
      <div class="top" style="margin-top:6px">
        <h1>{t("home.title")}</h1>
        <a class="pill" href="#/wallet" aria-label={t("home.balanceAria", { amount: money(me.balance) })} onClick={(e) => (e.preventDefault(), navigate("/wallet", { replace: true }))}>
          <span style="color:var(--acc);display:flex">
            <Icon name="wallet" size={17} />
          </span>
          {money(me.balance)}
        </a>
      </div>

      <label class="search">
        <Icon name="search" size={18} stroke={2} />
        <span class="sr">{t("home.search")}</span>
        <input type="search" placeholder={t("home.search")} value={q} onInput={(e) => setQ(e.currentTarget.value)} enterKeyHint="search" />
      </label>

      {results ? (
        <div class="section">
          <h2 class="label">{t("home.results")}</h2>
          {results.length ? <ServiceRows items={results} showPlatform /> : <div class="empty">{t("home.noResults", { q: q.trim() })}</div>}
        </div>
      ) : (
        <>
          <div class="section">
            <h2 class="label">{t("home.platforms")}</h2>
            <div class="card">
              {platforms.error ? (
                <ErrorState error={platforms.error} onRetry={platforms.reload} />
              ) : platforms.data ? (
                <PlatformGrid items={platforms.data} onPick={(slug) => navigate(`/p/${enc(slug)}`)} />
              ) : (
                <div style="padding:14px"><Skeleton h={150} /></div>
              )}
            </div>
          </div>

          {me.recent.length ? (
            <div class="section">
              <h2 class="label">
                {t("home.again")}
                <a href="#/orders" onClick={(e) => (e.preventDefault(), navigate("/orders", { replace: true }))}>
                  {t("home.allOrders")}
                </a>
              </h2>
              <div class="card">
                {me.recent.map((o) => (
                  <div class="row" key={o.id} style="min-height:58px">
                    <PlatformLogo slug={o.platform} size={34} radius={10} />
                    <span class="body">
                      <span class="grow">
                        <span class="t15 ellipsis">
                          {o.serviceName} · {num(o.quantity)}
                        </span>
                        <span class="meta ellipsis">
                          {platformName(o.platform)} · {prettyLink(o.link)}
                        </span>
                      </span>
                      <button
                        type="button"
                        class="chip sel"
                        style="height:30px;padding:0 12px;font-size:14px;border:0"
                        onClick={() => {
                          haptic.tap();
                          navigate(`/s/${o.serviceId}?link=${enc(o.link)}&qty=${o.quantity}`);
                        }}
                      >
                        {t("home.againBtn")}
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
