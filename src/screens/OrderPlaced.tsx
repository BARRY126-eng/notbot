import { useEffect, useState } from "preact/hooks";
import type { OrderView } from "../../shared/types";
import { api } from "../api";
import { money, num } from "../format";
import { t } from "../i18n";
import { refreshMe, updateMe } from "../me";
import { navigate } from "../router";
import { meStore } from "../store";
import { haptic, requestWriteAccess } from "../tg";
import { BottomButtons, Skeleton, Switch, errText, toast } from "../ui";
import { Icon } from "../icons";

/** After paying. For Stars orders (`?payment=`), waits until the bot has received the payment and placed the order. */
export function OrderPlaced({ orderId }: { orderId: number }) {
  const me = meStore.use()!;
  const [order, setOrder] = useState<OrderView | null>(null);
  const [waiting, setWaiting] = useState(!orderId);
  const paymentId = Number(new URLSearchParams(location.hash.split("?")[1] ?? "").get("payment")) || 0;

  useEffect(() => {
    let live = true;
    let tries = 0;
    const load = async () => {
      try {
        let id = orderId;
        if (!id && paymentId) {
          const p = await api<{ status: string; orderId: number | null }>(`/payments/${paymentId}`);
          if (p.orderId) id = p.orderId;
          else if (p.status === "paid" && ++tries > 6) {
            // Paid but the order couldn't be placed: the money is in the balance (the bot explains why)
            await refreshMe();
            navigate("/wallet", { replace: true });
            return;
          }
        }
        if (id) {
          const o = await api<OrderView>(`/orders/${id}`);
          if (!live) return;
          setOrder(o);
          setWaiting(false);
          if (!orderId) navigate(`/placed/${id}`, { replace: true });
          return;
        }
      } catch {
        /* keep polling */
      }
      if (live && tries < 40) setTimeout(load, 1500);
    };
    load();
    return () => {
      live = false;
    };
  }, [orderId]);

  const toggleNotify = async (on: boolean) => {
    try {
      if (on && !me.canMessage) {
        const ok = await requestWriteAccess();
        if (!ok) return toast(t("profile.notifyDenied"));
        await updateMe({ notify: true, canMessage: true });
      } else await updateMe({ notify: on });
      haptic.success();
    } catch (e) {
      toast(errText(e));
    }
  };

  return (
    <div class="screen no-tabs" style="align-items:center;padding-top:20px;padding-bottom:140px">
      <div aria-hidden="true" style="position:relative;width:200px;height:150px;flex:none">
        <span style="position:absolute;left:30px;top:5px;width:140px;height:140px;border-radius:999px;background:var(--sel)" />
        <span style="position:absolute;left:62px;top:37px;width:76px;height:76px;border-radius:999px;background:var(--lime);border:1.5px solid var(--ink);box-shadow:4px 8px 0 rgba(26,48,102,.12);display:flex;align-items:center;justify-content:center;color:var(--ink)">
          {waiting ? <span class="skel" style="width:30px;height:30px;border-radius:99px" /> : <Icon name="check" size={38} stroke={2.4} />}
        </span>
        <span style="position:absolute;left:14px;top:22px;width:38px;height:38px;border-radius:12px;background:#fff;border:1px solid #e3e3e8;transform:rotate(-10deg);display:flex;align-items:center;justify-content:center;color:var(--brand)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z" /></svg>
        </span>
        <span style="position:absolute;right:12px;bottom:16px;width:36px;height:36px;border-radius:11px;background:var(--pink);transform:rotate(9deg);display:flex;align-items:center;justify-content:center;color:var(--ink)">
          <Icon name="plane" size={18} stroke={1.8} />
        </span>
      </div>

      <div role="status" class="center" style="display:flex;flex-direction:column;gap:6px;max-width:320px">
        <h1 class="sm">{waiting ? t("placed.waitingPayment") : t("placed.title")}</h1>
        {order ? <p class="sub" style="font-size:15px;line-height:1.45;margin:0">{t("placed.body", { quantity: num(order.quantity), service: order.serviceName })}</p> : null}
      </div>

      {order ? (
        <>
          <dl class="card" style="width:100%">
            <div class="kv">
              <dt>{t("placed.order")}</dt>
              <dd>#{order.id}</dd>
            </div>
            <div class="kv">
              <dt>{t("placed.service")}</dt>
              <dd class="ellipsis">{order.serviceName}</dd>
            </div>
            <div class="kv">
              <dt>{t("placed.charged")}</dt>
              <dd style="font-weight:600">{order.paidWithStars ? t("placed.withStars", { amount: money(order.charge) }) : t("placed.fromBalance", { amount: money(order.charge) })}</dd>
            </div>
          </dl>
          <div class="card" style="width:100%">
            <div class="row" style="min-height:58px">
              <span class="tile" style="background:var(--pink)">
                <Icon name="bell" size={18} stroke={1.8} />
              </span>
              <span class="body">
                <span class="grow">
                  <span class="title">{t("placed.notify")}</span>
                  <span class="meta">{t("placed.notifySub")}</span>
                </span>
                <Switch on={me.notify && me.canMessage} label={t("placed.notify")} onChange={toggleNotify} />
              </span>
            </div>
          </div>
        </>
      ) : waiting ? (
        <Skeleton h={140} />
      ) : null}

      <BottomButtons
        main={{ text: t("common.done"), onClick: () => navigate("/", { replace: true }) }}
        secondary={order ? { text: t("placed.view"), onClick: () => navigate(`/order/${order.id}`, { replace: true }) } : null}
      />
    </div>
  );
}
