import { useState } from "preact/hooks";
import type { CategoryItem } from "../../shared/types";
import { platformName } from "../../shared/platforms";
import { cachedApi } from "../api";
import { money } from "../format";
import { t } from "../i18n";
import { categoryLook, Icon } from "../icons";
import { back, enc, navigate } from "../router";
import { BackNav, ErrorState, PlatformLogo, Row, Skeleton, useAsync } from "../ui";
import { PlatformSheet } from "./Pickers";

export function StepsBar({ children }: { children: preact.ComponentChildren }) {
  return (
    <nav class="steps" aria-label="Order steps">
      {children}
    </nav>
  );
}

export function Categories({ platform }: { platform: string }) {
  const cats = useAsync(() => cachedApi<CategoryItem[]>(`/catalog/categories?platform=${enc(platform)}`), [platform]);
  const [sheet, setSheet] = useState(false);
  const name = platformName(platform);
  return (
    <>
      <BackNav to="/" />
      <div class="screen with-bar">
        <div style="display:flex;align-items:center;gap:12px">
          <PlatformLogo slug={platform} size={48} radius={14} />
          <div>
            <h1 class="sm">{name}</h1>
            <span class="sub">{t("cat.choose")}</span>
          </div>
        </div>
        <div class="card">
          {cats.data ? (
            cats.data.length ? (
              cats.data.map((c) => {
                const look = categoryLook(c.name);
                return (
                  <Row
                    key={c.name}
                    icon={look.icon}
                    plate={look.plate}
                    title={c.name}
                    meta={`${t("cat.services", { n: c.count })} · ${t("cat.from", { price: money(c.fromRate) })}`}
                    href={`/p/${enc(platform)}/${enc(c.name)}`}
                  />
                );
              })
            ) : (
              <div class="empty">{t("svc.empty")}</div>
            )
          ) : cats.error ? (
            <ErrorState error={cats.error} onRetry={cats.reload} />
          ) : (
            <Skeleton h={50} n={6} />
          )}
        </div>
      </div>
      <StepsBar>
        <button type="button" class="round" aria-label={t("common.back")} onClick={() => back("/")}>
          <Icon name="back" size={22} stroke={2.4} class="rtl-flip" />
        </button>
        <button type="button" class="pick" onClick={() => setSheet(true)}>
          <span class="circle">
            <PlatformLogo slug={platform} size={32} radius={16} />
          </span>
          <span class="ellipsis" style="flex:1;text-align:start">{name}</span>
          <span style="font-weight:500">{t("common.change")}</span>
          <Icon name="down" size={14} stroke={2.4} />
        </button>
      </StepsBar>
      {sheet ? (
        <PlatformSheet
          current={platform}
          sub={t("cat.choose")}
          onClose={() => setSheet(false)}
          onPick={(slug) => {
            setSheet(false);
            if (slug !== platform) navigate(`/p/${enc(slug)}`, { replace: true });
          }}
        />
      ) : null}
    </>
  );
}
