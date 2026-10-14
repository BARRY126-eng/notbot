import { useState } from "preact/hooks";
import type { LedgerItem } from "../../shared/types";
import { api } from "../api";
import { dateTime, money } from "../format";
import { t } from "../i18n";
import { Icon, StarIcon } from "../icons";
import { navigate } from "../router";
import { meStore } from "../store";
import { haptic } from "../tg";
import { ErrorState, Row, Skeleton, useAsync } from "../ui";

function ledgerTitle(i: LedgerItem): string {
  if (i.kind === "order") return t("ledger.order", { id: i.ref ?? "" });
  if (i.kind === "refund") return t("ledger.refund", { id: i.ref ?? "" });
  return t(`ledger.${i.kind}`);
}

export function Wallet() {
  const me = meStore.use()!;
  const res = useAsync(() => api<{ balance: number; items: LedgerItem[] }>("/wallet"), []);
  const [extra, setExtra] = useState<LedgerItem[]>([]);
  const [more, setMore] = useState(true);
  const items = [...(res.data?.items ?? []), ...extra];
  const loadMore = async () => {
    const r = await api<{ items: LedgerItem[] }>(`/wallet?before=${items[items.length - 1].id}`);
    setExtra((x) => [...x, ...r.items]);
    setMore(r.items.length === 30);
  };
  const balance = res.data?.balance ?? me.balance;
  return (
    <div class="screen">
      <h1 style="margin-top:6px">{t("wallet.title")}</h1>

      <div style="position:relative;overflow:hidden;border-radius:20px;background:var(--brand);color:#fff;padding:16px 16px 16px 18px;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;min-height:120px">
        <span aria-hidden="true" style="position:absolute;right:-30px;top:-40px;width:140px;height:140px;border-radius:999px;border:2px dashed rgba(255,255,255,.3)" />
        <span aria-hidden="true" style="position:absolute;right:28px;top:18px;width:44px;height:32px;border-radius:9px;background:var(--lime);transform:rotate(10deg);box-shadow:3px 5px 0 rgba(10,24,90,.35)" />
        <div style="display:flex;flex-direction:column;gap:2px;position:relative">
          <span style="font-size:14px;opacity:.9">{t("wallet.balance")}</span>
          <b class="display" style="font-size:40px;letter-spacing:-1.6px;line-height:1.1">{money(balance)}</b>
        </div>
        <button
          type="button"
          onClick={() => (haptic.tap(), navigate("/topup"))}
          style="position:relative;height:38px;border:0;border-radius:999px;background:#fff;color:#1b45d6;font-size:15px;font-weight:600;display:flex;align-items:center;gap:6px;padding:0 14px"
        >
          <Icon name="plus" size={16} stroke={2.4} />
          {t("wallet.add")}
        </button>
      </div>

      <div class="section">
        <h2 class="label">{t("wallet.addWith")}</h2>
        <div class="card">
          <Row lead={<span class="tile" style="background:var(--cream)"><StarIcon size={18} /></span>} title={t("wallet.stars")} meta={t("wallet.starsSub")} href="/topup" />
        </div>
      </div>

      <div class="section">
        <h2 class="label">{t("wallet.history")}</h2>
        <div class="card">
          {res.error ? (
            <ErrorState error={res.error} onRetry={res.reload} />
          ) : !res.data ? (
            <Skeleton h={54} n={3} />
          ) : !items.length ? (
            <div class="empty">{t("wallet.empty")}</div>
          ) : (
            items.map((i) => (
              <Row
                key={i.id}
                title={ledgerTitle(i)}
                meta={dateTime(i.createdAt)}
                onClick={i.ref && (i.kind === "order" || i.kind === "refund") ? () => navigate(`/order/${i.ref}`) : undefined}
                chevron={false}
                value={<span style={`font-weight:600;color:${i.delta > 0 ? "var(--ok)" : "var(--fg)"}`}>{money(i.delta, { sign: true })}</span>}
              />
            ))
          )}
        </div>
        {res.data && items.length >= 30 && more ? (
          <button type="button" class="btn soft sm" onClick={loadMore}>
            {t("common.showMore")}
          </button>
        ) : null}
      </div>
    </div>
  );
}
