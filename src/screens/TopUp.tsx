import { useState } from "preact/hooks";
import { api } from "../api";
import { money, num } from "../format";
import { t } from "../i18n";
import { StarIcon } from "../icons";
import { refreshMe } from "../me";
import { navigate } from "../router";
import { meStore } from "../store";
import { haptic, openInvoice } from "../tg";
import { BackNav, BottomButtons, errText, toast } from "../ui";

const PRESETS = [1, 5, 10, 25, 50];

export function TopUp() {
  const me = meStore.use()!;
  const [text, setText] = useState("5");
  const [busy, setBusy] = useState(false);
  const amount = Number(text.replace(",", ".")) || 0;
  const micro = Math.round(amount * 1e6);
  const stars = Math.max(1, Math.ceil(amount * me.starsPerUsd - 1e-9));
  const valid = micro >= me.minTopup && micro <= me.maxTopup;

  const pay = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const r = await api<{ invoice: string; paymentId: number }>("/wallet/topup", { body: { amount } });
      const status = await openInvoice(r.invoice);
      if (status === "paid") {
        haptic.success();
        toast(t("topup.waiting"));
        // The bot credits the balance when Telegram confirms; poll briefly.
        for (let i = 0; i < 12; i++) {
          const p = await api<{ status: string }>(`/payments/${r.paymentId}`);
          if (p.status === "paid") break;
          await new Promise((res) => setTimeout(res, 1000));
        }
        await refreshMe();
        toast(t("topup.done", { amount: money(micro) }));
        navigate("/wallet", { replace: true });
        return;
      }
    } catch (e) {
      haptic.error();
      toast(errText(e));
    }
    setBusy(false);
  };

  return (
    <>
      <BackNav to="/wallet" />
      <div class="screen no-tabs" style="padding-bottom:calc(120px + var(--safe-bottom))">
        <div>
          <h1 class="sm">{t("topup.title")}</h1>
          <span class="sub">{t("topup.balance", { amount: money(me.balance) })}</span>
        </div>
        <div class="section">
          <label class="label" for="amt">
            {t("topup.amount")}
          </label>
          <div class="card" style="padding:14px;display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:center;gap:4px">
              <span class="display" style="font-size:34px;color:var(--hint)">$</span>
              <input
                id="amt"
                class="display"
                inputMode="decimal"
                style="flex:1;min-width:0;border:0;outline:0;background:transparent;font-size:34px;letter-spacing:-1.2px"
                value={text}
                onInput={(e) => setText(e.currentTarget.value.replace(/[^\d.,]/g, ""))}
              />
              <span style="display:flex;align-items:center;gap:4px;font-weight:600;font-size:15px">
                <StarIcon size={16} />
                {num(stars)}
              </span>
            </div>
            <div class="presets">
              {PRESETS.map((p) => (
                <button type="button" key={p} class="preset" aria-pressed={amount === p} onClick={() => (haptic.select(), setText(String(p)))}>
                  ${p}
                </button>
              ))}
            </div>
          </div>
          <p class="note" style="margin:0">
            {t("topup.rate", { n: me.starsPerUsd })} · {t("topup.limits", { min: money(me.minTopup), max: money(me.maxTopup) })}
          </p>
        </div>
        <div class="card pad" style="display:flex;gap:12px;align-items:center">
          <span class="tile" style="background:var(--cream)">
            <StarIcon size={18} />
          </span>
          <span class="sub" style="font-size:14px;line-height:1.4">{t("topup.note")}</span>
        </div>
        {!valid && text ? <div class="err-box">{t("err.INVALID_AMOUNT", { min: money(me.minTopup), max: money(me.maxTopup) })}</div> : null}
      </div>
      <BottomButtons main={{ text: t("topup.pay", { stars: num(stars) }), onClick: pay, progress: busy, disabled: !valid, shine: true }} />
    </>
  );
}
