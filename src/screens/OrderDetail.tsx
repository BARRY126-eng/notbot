import { useEffect, useState } from "preact/hooks";
import { FINAL_STATUSES, type OrderView } from "../../shared/types";
import { platformName } from "../../shared/platforms";
import { api } from "../api";
import { dateTime, money, num, prettyLink } from "../format";
import { t, type Key } from "../i18n";
import { Icon } from "../icons";
import { refreshMe } from "../me";
import { enc, navigate } from "../router";
import { meStore } from "../store";
import { confirmDialog, haptic, openLink, openTelegramLink } from "../tg";
import { BackNav, BottomButtons, ErrorState, PlatformLogo, Row, Skeleton, StatusPill, errText, toast, useAsync } from "../ui";

export function OrderDetail({ orderId }: { orderId: number }) {
  const me = meStore.use()!;
  const res = useAsync(() => api<OrderView>(`/orders/${orderId}`), [orderId]);
  const [busy, setBusy] = useState(false);
  const o = res.data;

  // Keep an open order fresh while it's on screen
  useEffect(() => {
    if (!o || FINAL_STATUSES.includes(o.status)) return;
    const id = setInterval(() => api<OrderView>(`/orders/${orderId}`).then(res.set, () => undefined), 15000);
    return () => clearInterval(id);
  }, [o?.status]);

  if (res.error)
    return (
      <>
        <BackNav to="/orders" />
        <div class="screen no-tabs">
          <ErrorState error={res.error} onRetry={res.reload} />
        </div>
      </>
    );
  if (!o)
    return (
      <>
        <BackNav to="/orders" />
        <div class="screen no-tabs">
          <Skeleton h={52} />
          <Skeleton h={120} />
          <Skeleton h={140} />
        </div>
      </>
    );

  const delivered = o.remains !== null ? Math.max(0, o.quantity - o.remains) : o.status === "completed" ? o.quantity : 0;
  const pct = o.quantity ? Math.min(100, (delivered / o.quantity) * 100) : 0;

  const cancel = async () => {
    const ok = await confirmDialog(t("detail.cancelConfirm", { id: o.id }), t("detail.cancelYes"), t("detail.cancelNo"), true);
    if (!ok) return;
    setBusy(true);
    try {
      const updated = await api<OrderView>(`/orders/${o.id}/cancel`, { method: "POST" });
      res.set(updated);
      haptic.success();
      if (updated.status === "cancelled") void refreshMe();
      else toast(t("detail.cancelRequested"));
    } catch (e) {
      haptic.error();
      toast(errText(e));
    }
    setBusy(false);
  };

  const refill = async () => {
    setBusy(true);
    try {
      res.set(await api<OrderView>(`/orders/${o.id}/refill`, { method: "POST" }));
      haptic.success();
      toast(t("detail.refillPending"));
    } catch (e) {
      haptic.error();
      toast(errText(e));
    }
    setBusy(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(o.link);
      haptic.success();
      toast(t("common.copied"));
    } catch {
      /* ignore */
    }
  };

  const KNOWN = ["partially_delivered", "link_invalid", "link_busy", "service_unavailable"];
  const reason = o.reasonCode ? t((KNOWN.includes(o.reasonCode) ? `reason.${o.reasonCode}` : "reason.generic") as Key) : null;

  const support = () => (me.supportUsername ? openTelegramLink(`https://t.me/${me.supportUsername}`) : me.botUsername ? openTelegramLink(`https://t.me/${me.botUsername}`) : undefined);

  return (
    <>
      <BackNav to="/orders" />
      <div class="screen no-tabs" style="padding-bottom:calc(120px + var(--safe-bottom))">
        <div style="display:flex;align-items:center;gap:12px">
          <PlatformLogo slug={o.platform} size={52} radius={15} />
          <div style="min-width:0">
            <h1 class="xs">{o.serviceName}</h1>
            <span class="sub">
              {t("detail.title", { id: o.id })} · {platformName(o.platform)}
            </span>
          </div>
        </div>

        <div class="card" style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;align-items:baseline;gap:8px">
            <b class="display" style="font-size:34px;letter-spacing:-1.2px">{num(delivered)}</b>
            <span class="sub" style="font-size:15px;flex:1">{t("detail.delivered", { total: num(o.quantity) })}</span>
            <StatusPill status={o.status} />
          </div>
          <div class="bar lg" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <i style={`width:${pct}%`} />
          </div>
          <span class="sub" style="font-size:13px">
            {[o.startCount !== null ? t("detail.startedAt", { n: num(o.startCount) }) : null, o.remains ? t("detail.left", { n: num(o.remains) }) : null].filter(Boolean).join(" · ")}
          </span>
          {reason && (o.status === "partial" || o.status === "cancelled" || o.status === "failed") ? <div class="warn-box">{reason}</div> : null}
        </div>

        <div class="section">
          <h2 class="label">{t("detail.details")}</h2>
          <dl class="card">
            <div class="kv" style="padding-inline-end:4px">
              <dt>{t("detail.link")}</dt>
              <dd style="display:flex;align-items:center;gap:4px;min-width:0">
                <button type="button" class="textbtn ellipsis" style="padding:0;max-width:200px;color:var(--fg);font-size:15px" onClick={() => openLink(o.link.startsWith("http") ? o.link : `https://${o.link}`)}>
                  {prettyLink(o.link)}
                </button>
                <button type="button" class="iconbtn lg" style="background:transparent" aria-label={t("detail.copy")} onClick={copy}>
                  <Icon name="copy" size={18} />
                </button>
              </dd>
            </div>
            <div class="kv">
              <dt>{t("detail.charged")}</dt>
              <dd>
                {money(o.charge)}
                {o.paidWithStars ? ` · ${t("detail.paidStars")}` : ""}
              </dd>
            </div>
            {o.refund ? (
              <div class="kv">
                <dt>{t("detail.refund")}</dt>
                <dd style="color:var(--ok);font-weight:600">{money(o.refund, { sign: true })}</dd>
              </div>
            ) : null}
            <div class="kv">
              <dt>{t("detail.placed")}</dt>
              <dd>{dateTime(o.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div class="card">
          {o.canRefill ? <Row icon="refill" plate="var(--lime)" title={t("detail.refill")} onClick={busy ? undefined : refill} chevron={false} /> : null}
          {o.refillStatus ? (
            <Row
              icon="refill"
              plate="var(--lime)"
              title={t(o.refillStatus === "completed" ? "detail.refillDone" : o.refillStatus === "rejected" ? "detail.refillRejected" : "detail.refillPending")}
              chevron={false}
            />
          ) : null}
          <Row icon="chat" plate="var(--sky)" title={t("detail.support")} accent onClick={support} chevron={false} />
          {o.canCancel ? <Row icon="cancel" plate="var(--st-cancel-bg)" title={t("detail.cancel")} danger onClick={busy ? undefined : cancel} chevron={false} /> : null}
        </div>
      </div>
      <BottomButtons
        main={{ text: t("detail.again"), onClick: () => navigate(`/s/${o.serviceId}?link=${enc(o.link)}&qty=${o.quantity}`) }}
        secondary={{ text: t("common.back"), onClick: () => navigate("/orders", { replace: true }) }}
      />
    </>
  );
}
