// Bottom sheets to switch platform / category / service without leaving the screen ("thumb first").
import type { CategoryItem, PlatformItem, ServiceItem } from "../../shared/types";
import { platformName } from "../../shared/platforms";
import { cachedApi } from "../api";
import { money, short } from "../format";
import { t } from "../i18n";
import { Icon } from "../icons";
import { enc } from "../router";
import { haptic } from "../tg";
import { ErrorState, Sheet, Skeleton, useAsync } from "../ui";
import { PlatformGrid } from "./Home";

export function PlatformSheet({ current, sub, onPick, onClose }: { current: string; sub?: string; onPick: (slug: string) => void; onClose: () => void }) {
  const list = useAsync(() => cachedApi<PlatformItem[]>("/catalog/platforms"), []);
  return (
    <Sheet title={t("sheet.platform")} sub={sub ?? t("sheet.platformSub")} onClose={onClose}>
      {list.data ? <PlatformGrid items={list.data} current={current} onPick={onPick} /> : list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <Skeleton h={150} />}
    </Sheet>
  );
}

function CheckRow({ title, meta, value, on, onClick }: { title: string; meta?: string; value?: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      class="row"
      onClick={() => {
        haptic.select();
        onClick();
      }}
    >
      <span class="body" style="min-height:50px">
        <span class="grow">
          <span class="title">{title}</span>
          {meta ? <span class="meta">{meta}</span> : null}
        </span>
        {value ? <span class="value" style="color:var(--acc);font-weight:600">{value}</span> : null}
        <span style={`color:var(--acc);opacity:${on ? 1 : 0}`}>
          <Icon name="check" size={18} stroke={2.4} />
        </span>
      </span>
    </button>
  );
}

export function CategorySheet({ platform, current, onPick, onClose }: { platform: string; current: string; onPick: (c: string) => void; onClose: () => void }) {
  const list = useAsync(() => cachedApi<CategoryItem[]>(`/catalog/categories?platform=${enc(platform)}`), [platform]);
  return (
    <Sheet title={t("sheet.category")} sub={platformName(platform)} onClose={onClose}>
      <div class="card">
        {list.data ? (
          list.data.map((c) => <CheckRow key={c.name} title={c.name} meta={t("cat.services", { n: c.count })} on={c.name === current} onClick={() => onPick(c.name)} />)
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <Skeleton h={50} n={4} />
        )}
      </div>
    </Sheet>
  );
}

export function ServiceSheet({ platform, category, current, onPick, onClose }: { platform: string; category: string; current: number; onPick: (s: ServiceItem) => void; onClose: () => void }) {
  const list = useAsync(() => cachedApi<{ items: ServiceItem[] }>(`/catalog/services?platform=${enc(platform)}&category=${enc(category)}`), [platform, category]);
  return (
    <Sheet title={t("sheet.service")} sub={`${platformName(platform)} · ${category}`} onClose={onClose}>
      <div class="card">
        {list.data ? (
          list.data.items.map((s) => (
            <CheckRow key={s.id} title={s.name} meta={`${t("common.min")} ${short(s.min)} · ${t("common.max")} ${short(s.max)}`} value={money(s.rate)} on={s.id === current} onClick={() => onPick(s)} />
          ))
        ) : list.error ? (
          <ErrorState error={list.error} onRetry={list.reload} />
        ) : (
          <Skeleton h={58} n={4} />
        )}
      </div>
    </Sheet>
  );
}
