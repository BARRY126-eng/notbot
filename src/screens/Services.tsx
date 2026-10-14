import { useEffect, useState } from "preact/hooks";
import type { ServiceItem } from "../../shared/types";
import { platformName } from "../../shared/platforms";
import { cachedApi } from "../api";
import { duration, money, short } from "../format";
import { t } from "../i18n";
import { Icon } from "../icons";
import { back, enc, navigate } from "../router";
import { haptic } from "../tg";
import { BackNav, ErrorState, PlatformLogo, Skeleton, useAsync } from "../ui";
import { StepsBar } from "./Categories";
import { CategorySheet, PlatformSheet } from "./Pickers";

const units = () => ({ m: t("units.m"), h: t("units.h"), d: t("units.d") });

export function ServiceRows({ items, showPlatform }: { items: ServiceItem[]; showPlatform?: boolean }) {
  return (
    <div class="card">
      {items.map((s) => (
        <button
          type="button"
          class="row"
          key={s.id}
          onClick={() => {
            haptic.tap();
            navigate(`/s/${s.id}`);
          }}
        >
          {showPlatform ? <PlatformLogo slug={s.platform} size={34} radius={10} /> : null}
          <span class="body" style="min-height:72px">
            <span class="grow" style="gap:3px">
              <span style="font-size:16px;line-height:1.3">{s.name}</span>
              <span class="meta">
                {showPlatform ? `${platformName(s.platform)} · ${s.category} · ` : ""}
                {t("svc.meta", { id: s.id, min: short(s.min), max: short(s.max) })}
                {s.avgMinutes ? ` · ~${duration(s.avgMinutes, units())}` : ""}
              </span>
            </span>
            <span style="display:flex;flex-direction:column;align-items:flex-end;flex:none">
              <span style="font-size:16px;font-weight:600;color:var(--acc)">{money(s.rate)}</span>
              <span style="font-size:12px;color:var(--hint)">{t("common.per1k")}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function Services({ platform, category }: { platform: string; category: string }) {
  const [pages, setPages] = useState<ServiceItem[][]>([]);
  const [more, setMore] = useState(false);
  const first = useAsync(() => cachedApi<{ items: ServiceItem[]; more: boolean }>(`/catalog/services?platform=${enc(platform)}&category=${enc(category)}`), [platform, category]);
  const [sheet, setSheet] = useState<"platform" | "category" | null>(null);
  const [pendingPlatform, setPendingPlatform] = useState<string | null>(null);

  useEffect(() => {
    if (first.data) {
      setPages([first.data.items]);
      setMore(first.data.more);
    }
  }, [first.data]);

  const loadMore = async () => {
    const r = await cachedApi<{ items: ServiceItem[]; more: boolean }>(`/catalog/services?platform=${enc(platform)}&category=${enc(category)}&page=${pages.length}`);
    setPages((p) => [...p, r.items]);
    setMore(r.more);
  };

  const items = pages.flat();
  return (
    <>
      <BackNav to={`/p/${enc(platform)}`} />
      <div class="screen with-bar">
        <div>
          <h1 class="sm">{category}</h1>
          <span class="sub">{t("svc.choose", { platform: platformName(platform) })}</span>
        </div>
        {first.error ? (
          <ErrorState error={first.error} onRetry={first.reload} />
        ) : first.data ? (
          items.length ? (
            <>
              <ServiceRows items={items} />
              {more ? (
                <button type="button" class="btn soft sm" onClick={loadMore}>
                  {t("common.showMore")}
                </button>
              ) : null}
              <p class="note" style="margin:0">{t("svc.footnote")}</p>
            </>
          ) : (
            <div class="empty">{t("svc.empty")}</div>
          )
        ) : (
          <Skeleton h={72} n={5} />
        )}
      </div>
      <StepsBar>
        <button type="button" class="round" aria-label={t("common.back")} onClick={() => back(`/p/${enc(platform)}`)}>
          <Icon name="back" size={22} stroke={2.4} class="rtl-flip" />
        </button>
        <button type="button" class="pick plain" aria-label={`${t("sheet.platform")}: ${platformName(platform)}`} onClick={() => setSheet("platform")}>
          <span class="circle">
            <PlatformLogo slug={platform} size={32} radius={16} />
          </span>
          <Icon name="down" size={14} stroke={2.4} />
        </button>
        <button type="button" class="pick" onClick={() => setSheet("category")}>
          <span class="ellipsis" style="flex:1;text-align:start;padding-inline-start:6px">{category}</span>
          <span style="font-weight:500">{t("common.change")}</span>
          <Icon name="down" size={14} stroke={2.4} />
        </button>
      </StepsBar>
      {sheet === "platform" ? (
        <PlatformSheet
          current={platform}
          onClose={() => setSheet(null)}
          onPick={(slug) => {
            setPendingPlatform(slug);
            setSheet("category");
          }}
        />
      ) : null}
      {sheet === "category" ? (
        <CategorySheet
          platform={pendingPlatform ?? platform}
          current={pendingPlatform ? "" : category}
          onClose={() => {
            setSheet(null);
            setPendingPlatform(null);
          }}
          onPick={(c) => {
            setSheet(null);
            const p = pendingPlatform ?? platform;
            setPendingPlatform(null);
            navigate(`/p/${enc(p)}/${enc(c)}`, { replace: true });
          }}
        />
      ) : null}
    </>
  );
}
