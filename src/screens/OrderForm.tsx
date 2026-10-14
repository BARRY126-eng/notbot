import { useEffect, useMemo, useState } from "preact/hooks";
import type { OrderView, ServiceDetail, ServiceField } from "../../shared/types";
import { platformName } from "../../shared/platforms";
import { api, ApiError, cachedApi } from "../api";
import { duration, money, num } from "../format";
import { t } from "../i18n";
import { Icon, StarIcon } from "../icons";
import { enc, navigate } from "../router";
import { refreshMe } from "../me";
import { meStore } from "../store";
import { closingConfirmation, haptic, openInvoice } from "../tg";
import { BackNav, BottomButtons, ErrorState, PlatformLogo, Skeleton, errText, toast, useAsync } from "../ui";
import { CategorySheet, PlatformSheet, ServiceSheet } from "./Pickers";

const units = () => ({ m: t("units.m"), h: t("units.h"), d: t("units.d") });
const PRESETS = [100, 500, 1000, 5000, 10000, 50000];
const SPEEDS = [60, 360, 720, 1440, 2880];

function charge(svc: ServiceDetail, qty: number): number {
  if (svc.quantityMode === "fixed") return svc.rate;
  return Math.max(1, Math.ceil((svc.rate * qty) / 1000));
}

function stepFor(svc: ServiceDetail): number {
  const s = Math.max(svc.step, svc.min >= 1000 ? 1000 : svc.min >= 100 ? 100 : 10);
  return Math.ceil(s / svc.step) * svc.step;
}

function clampQty(svc: ServiceDetail, q: number): number {
  let v = Math.min(svc.max, Math.max(svc.min, Math.round(q)));
  if (svc.step > 1) v = Math.floor(v / svc.step) * svc.step || svc.step;
  return v;
}

const countLines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean).length;

export function OrderForm({ serviceId, query }: { serviceId: number; query: URLSearchParams }) {
  const res = useAsync(() => cachedApi<ServiceDetail>(`/catalog/service/${serviceId}`), [serviceId]);
  return (
    <>
      <BackNav to="/" />
      {res.error ? (
        <div class="screen no-tabs">
          <ErrorState error={res.error} onRetry={res.reload} />
        </div>
      ) : res.data ? (
        <Form key={serviceId} svc={res.data} query={query} />
      ) : (
        <div class="screen no-tabs">
          <Skeleton h={96} />
          <Skeleton h={52} />
          <Skeleton h={130} />
        </div>
      )}
    </>
  );
}

function Form({ svc, query }: { svc: ServiceDetail; query: URLSearchParams }) {
  const me = meStore.use()!;
  const [link, setLink] = useState(query.get("link") ?? "");
  const [qty, setQty] = useState(() => clampQty(svc, Number(query.get("qty")) || (svc.min <= 1000 && svc.max >= 1000 ? 1000 : svc.min)));
  const [qtyText, setQtyText] = useState(String(qty));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [drip, setDrip] = useState(0);
  const [payWith, setPayWith] = useState<"balance" | "stars">("balance");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [sheet, setSheet] = useState<"platform" | "category" | "service" | null>(null);
  const [pickPlatform, setPickPlatform] = useState<string | null>(null);

  const linesKey = svc.linesField;
  const quantity = svc.quantityMode === "lines" && linesKey ? countLines(fields[linesKey] ?? "") : svc.quantityMode === "fixed" ? svc.min : qty;
  const total = charge(svc, quantity);
  const stars = Math.max(1, Math.ceil((total / 1e6) * me.starsPerUsd - 1e-9));
  const enough = me.balance >= total;

  useEffect(() => {
    closingConfirmation(!!link.trim());
    return () => closingConfirmation(false);
  }, [!!link.trim()]);

  // Offer Stars when the balance can't cover the order
  useEffect(() => {
    if (!enough && payWith === "balance") setPayWith("stars");
  }, [enough]);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (link.trim().length < 2) m.push("link");
    for (const f of svc.fields) if (f.required && !(fields[f.key] ?? "").trim()) m.push(f.key);
    if (svc.quantityMode === "lines" && (quantity < svc.min || quantity > svc.max)) m.push(linesKey ?? "lines");
    return m;
  }, [link, fields, quantity]);

  const setQuantity = (v: number) => {
    const c = clampQty(svc, v);
    setQty(c);
    setQtyText(String(c));
  };

  const submit = async () => {
    if (missing.length) {
      setShowErrors(true);
      haptic.error();
      setError(missing.includes("link") ? t("err.INVALID_LINK") : t("err.MISSING_FIELD"));
      return;
    }
    setError(null);
    setBusy(true);
    const body = {
      serviceId: svc.id,
      link: link.trim(),
      quantity,
      fields: Object.fromEntries(Object.entries(fields).filter(([, v]) => v.trim())),
      dripMinutes: drip || undefined,
      payWith,
    };
    try {
      if (payWith === "stars") {
        const r = await api<{ invoice: string; paymentId: number }>("/orders", { body });
        const status = await openInvoice(r.invoice);
        if (status === "paid" || status === "pending") {
          haptic.success();
          closingConfirmation(false);
          navigate(`/placed/0?payment=${r.paymentId}`, { replace: true });
        } else setBusy(false);
        return;
      }
      const r = await api<{ order: OrderView }>("/orders", { body });
      haptic.success();
      closingConfirmation(false);
      void refreshMe();
      navigate(`/placed/${r.order.id}`, { replace: true });
    } catch (e) {
      haptic.error();
      setBusy(false);
      setError(errText(e));
      if (e instanceof ApiError && e.code === "INSUFFICIENT_FUNDS") setPayWith("stars");
    }
  };

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setLink(text.trim());
    } catch {
      toast(t("form.linkPh"));
    }
  };

  const presets = PRESETS.filter((p) => p >= svc.min && p <= svc.max && (svc.step <= 1 || p % svc.step === 0)).slice(0, 5);
  const speeds = svc.dripFeed ? SPEEDS.filter((m) => m <= svc.dripFeed!.max_total_minutes) : [];
  const invalid = (k: string) => showErrors && missing.includes(k);

  return (
    <div class="screen no-tabs" style="padding-bottom:calc(200px + var(--safe-bottom))">
      {/* Summary */}
      <div class="card pad" style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;gap:12px;align-items:center">
          <PlatformLogo slug={svc.platform} size={40} radius={11} />
          <div style="min-width:0;display:flex;flex-direction:column;gap:2px">
            <b style="font-size:17px;line-height:1.25">{svc.name}</b>
            <span class="sub" style="font-size:13px">
              {platformName(svc.platform)} · {svc.category} · ID {svc.id}
            </span>
          </div>
        </div>
        <div class="chips">
          <span class="chip sel">
            {money(svc.rate)} {svc.quantityMode === "fixed" ? "" : t("common.per1k")}
          </span>
          {svc.quantityMode !== "fixed" ? (
            <span class="chip">
              {t("common.min")} {num(svc.min)} · {t("common.max")} {num(svc.max)}
            </span>
          ) : null}
          {svc.avgMinutes ? (
            <span class="chip">
              <Icon name="clock" size={13} stroke={2.2} />
              {t("form.avgTime", { time: duration(svc.avgMinutes, units()) })}
            </span>
          ) : null}
          {svc.refill ? (
            <span class="chip">
              <Icon name="refill" size={13} stroke={2.2} />
              {t("form.refill")}
            </span>
          ) : null}
        </div>
        {svc.description ? <p class="desc" style="padding:0;margin:0">{svc.description}</p> : null}
      </div>

      {/* Link */}
      <div class="section">
        <label class="label" for="lnk">
          {t("form.link")}
        </label>
        <div class={`card field ${invalid("link") ? "invalid" : ""}`}>
          <Icon name="link" size={18} />
          <input id="lnk" type="url" inputMode="url" autoComplete="off" autoCapitalize="off" spellcheck={false} placeholder={t("form.linkPh")} value={link} onInput={(e) => setLink(e.currentTarget.value)} />
          {!link && "readText" in (navigator.clipboard ?? {}) ? (
            <button type="button" class="textbtn" onClick={paste}>
              {t("form.paste")}
            </button>
          ) : null}
        </div>
      </div>

      {/* Amount */}
      {svc.quantityMode === "free" ? (
        <div class="section">
          <h2 class="label">{t("form.amount")}</h2>
          <div class="card" style="padding:10px 14px 12px;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:8px">
              <button type="button" class="iconbtn lg" aria-label={t("form.fewer")} style="color:var(--fg)" onClick={() => (haptic.select(), setQuantity(qty - stepFor(svc)))}>
                <Icon name="minus" size={20} stroke={2.4} />
              </button>
              <div style="flex:1;display:flex;flex-direction:column;align-items:center">
                <input
                  aria-label={t("form.amount")}
                  class="display"
                  inputMode="numeric"
                  style="width:100%;border:0;outline:0;background:transparent;text-align:center;font-size:30px"
                  value={qtyText}
                  onInput={(e) => {
                    const digits = e.currentTarget.value.replace(/\D/g, "");
                    setQtyText(digits);
                    if (digits) setQty(Math.min(svc.max, Number(digits)));
                  }}
                  onBlur={() => setQuantity(Number(qtyText) || svc.min)}
                />
                <span class="sub" style="font-size:13px">{svc.category.toLowerCase()}</span>
              </div>
              <button type="button" class="iconbtn lg" aria-label={t("form.more")} style="color:var(--fg)" onClick={() => (haptic.select(), setQuantity(qty + stepFor(svc)))}>
                <Icon name="plus" size={20} stroke={2.4} />
              </button>
            </div>
            {presets.length ? (
              <div class="presets">
                {presets.map((p) => (
                  <button type="button" class="preset" key={p} aria-pressed={qty === p} onClick={() => (haptic.select(), setQuantity(p))}>
                    {p >= 1000 ? `${p / 1000}K` : p}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : svc.quantityMode === "fixed" ? (
        <p class="note" style="margin:0">{t("form.packageNote")}</p>
      ) : null}

      {/* Extra fields from NotPanel */}
      {svc.fields.map((f) => (
        <FieldInput key={f.key} f={f} value={fields[f.key] ?? ""} invalid={invalid(f.key)} isLines={f.key === linesKey} onChange={(v) => setFields((x) => ({ ...x, [f.key]: v }))} />
      ))}

      {/* Speed (drip-feed) */}
      {speeds.length ? (
        <div class="section">
          <h2 class="label">{t("form.speed")}</h2>
          <div class="chips">
            <button type="button" class={`chip ${drip === 0 ? "sel" : ""}`} style="border:0;height:34px" onClick={() => (haptic.select(), setDrip(0))}>
              {t("form.speedFast")}
            </button>
            {speeds.map((m) => (
              <button type="button" key={m} class={`chip ${drip === m ? "sel" : ""}`} style="border:0;height:34px" onClick={() => (haptic.select(), setDrip(m))}>
                {duration(m, units())}
              </button>
            ))}
          </div>
          {drip ? <p class="note" style="margin:0">{t("form.speedOver", { time: duration(drip, units()) })}</p> : null}
        </div>
      ) : null}

      {/* Pay with */}
      <div class="section">
        <h2 class="label">{t("form.payWith")}</h2>
        <div role="radiogroup" aria-label={t("form.payWith")} style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <PayOption on={payWith === "balance"} onClick={() => setPayWith("balance")} title={t("form.balance")} sub={money(me.balance)} icon={<Icon name="wallet" size={17} />} plate="var(--lavender)" />
          <PayOption on={payWith === "stars"} onClick={() => setPayWith("stars")} title={t("form.stars")} sub={`${num(stars)} ⭐`} icon={<StarIcon size={17} />} plate="var(--cream)" />
        </div>
      </div>

      {error ? (
        <div class="err-box" role="alert">
          {error}
        </div>
      ) : null}

      {/* Quick change + summary, above Telegram's bottom buttons */}
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">
        <span class="sub" style="font-size:12px;padding:0 4px">{t("form.tapToChange")}</span>
        <div style="display:flex;gap:6px;overflow-x:auto;margin:0 -16px;padding:0 16px">
          <QuickChip onClick={() => setSheet("platform")} lead={<PlatformLogo slug={svc.platform} size={26} radius={13} />}>
            {platformName(svc.platform)}
          </QuickChip>
          <QuickChip onClick={() => setSheet("category")}>{svc.category}</QuickChip>
          <QuickChip onClick={() => setSheet("service")}>{t("form.service")}</QuickChip>
        </div>
        <div class="card pad" style="display:flex;justify-content:space-between;align-items:center">
          <span>
            {t("form.total")} · {num(quantity)}
          </span>
          <b class="display" style="font-size:22px;letter-spacing:-0.5px">
            {payWith === "stars" ? `${num(stars)} ⭐` : money(total)}
          </b>
        </div>
        <p class="sub center" style="font-size:13px;margin:0">
          {payWith === "stars" ? t("form.starsNote") : enough ? t("form.balanceAfter", { amount: money(me.balance - total) }) : t("form.notEnough", { amount: money(total - me.balance) })}
        </p>
      </div>

      <BottomButtons
        main={{
          text: payWith === "stars" ? t("form.payStars", { stars: num(stars) }) : t("form.pay", { amount: money(total) }),
          onClick: submit,
          progress: busy,
          disabled: payWith === "balance" && !enough,
          shine: true,
        }}
        secondary={{ text: t("common.cancel"), onClick: () => navigate("/", { replace: true }) }}
      />

      {sheet === "platform" ? (
        <PlatformSheet
          current={svc.platform}
          onClose={() => setSheet(null)}
          onPick={(p) => {
            setPickPlatform(p);
            setSheet("category");
          }}
        />
      ) : null}
      {sheet === "category" ? (
        <CategorySheet
          platform={pickPlatform ?? svc.platform}
          current={pickPlatform ? "" : svc.category}
          onClose={() => (setSheet(null), setPickPlatform(null))}
          onPick={(c) => {
            setSheet(null);
            setPickPlatform(null);
            navigate(`/p/${enc(pickPlatform ?? svc.platform)}/${enc(c)}`, { replace: true });
          }}
        />
      ) : null}
      {sheet === "service" ? (
        <ServiceSheet
          platform={svc.platform}
          category={svc.category}
          current={svc.id}
          onClose={() => setSheet(null)}
          onPick={(s) => {
            setSheet(null);
            if (s.id !== svc.id) navigate(`/s/${s.id}?link=${enc(link)}&qty=${qty}`, { replace: true });
          }}
        />
      ) : null}
    </div>
  );
}

function PayOption({ on, onClick, title, sub, icon, plate }: { on: boolean; onClick: () => void; title: string; sub: string; icon: preact.ComponentChildren; plate: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => (haptic.select(), onClick())}
      style={`height:58px;border-radius:16px;background:var(--card);border:2px solid ${on ? "var(--brand)" : "transparent"};display:flex;align-items:center;gap:10px;padding:0 12px;text-align:start`}
    >
      <span class="tile sm" style={`background:${plate};color:var(--sel-fg)`}>
        {icon}
      </span>
      <span style="display:flex;flex-direction:column;min-width:0">
        <b style="font-size:15px">{title}</b>
        <span class="sub ellipsis" style="font-size:12px">
          {sub}
        </span>
      </span>
    </button>
  );
}

function QuickChip({ onClick, lead, children }: { onClick: () => void; lead?: preact.ComponentChildren; children: preact.ComponentChildren }) {
  return (
    <button
      type="button"
      onClick={() => (haptic.tap(), onClick())}
      style="height:40px;flex:none;border-radius:999px;border:1px solid var(--sep);background:var(--card);display:flex;align-items:center;gap:6px;padding:0 12px 0 8px;font-size:14px;font-weight:600;max-width:70%"
    >
      {lead}
      <span class="ellipsis">{children}</span>
      <Icon name="down" size={14} stroke={2.4} />
    </button>
  );
}

function FieldInput({ f, value, onChange, invalid, isLines }: { f: ServiceField; value: string; onChange: (v: string) => void; invalid: boolean; isLines: boolean }) {
  const id = `f-${f.key}`;
  const label = (
    <label class="label" for={id}>
      <span>
        {f.label}
        {f.required ? " *" : ""}
      </span>
      {f.kind === "lines" ? <span style="text-transform:none">{t("form.lines", { n: countLines(value) })}</span> : null}
    </label>
  );
  if (f.kind === "reactions" && f.allowed?.length) {
    const picked = value ? value.split(",") : [];
    const max = f.max_distinct ?? 11;
    const toggle = (e: string) => {
      haptic.select();
      const next = picked.includes(e) ? picked.filter((x) => x !== e) : picked.length < max ? [...picked, e] : picked;
      onChange(next.join(","));
    };
    return (
      <div class="section">
        <h2 class="label">{t("form.reactions")}</h2>
        <div class="card emoji-grid">
          {f.allowed.map((e) => (
            <button type="button" key={e} aria-pressed={picked.includes(e)} onClick={() => toggle(e)}>
              {e}
            </button>
          ))}
        </div>
        <p class="note" style="margin:0">{t("form.reactionsNote", { n: max })}</p>
      </div>
    );
  }
  if (f.kind === "choice" && f.choices?.length) {
    return (
      <div class="section">
        <h2 class="label">{f.label}</h2>
        <div class="chips">
          {f.choices.map((c) => (
            <button type="button" key={c} class={`chip ${value === c ? "sel" : ""}`} style="border:0;height:34px" onClick={() => (haptic.select(), onChange(value === c ? "" : c))}>
              {c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div class="section">
      {label}
      <div class={`card field ${f.kind === "lines" ? "top" : ""} ${invalid ? "invalid" : ""}`}>
        {f.kind === "lines" ? (
          <textarea id={id} value={value} rows={5} maxLength={f.max_length ? f.max_length * 10000 : undefined} onInput={(e) => onChange(e.currentTarget.value)} />
        ) : (
          <input
            id={id}
            value={value}
            type={(f.kind === "url" ? "url" : "text") as "text"}
            inputMode={(f.kind === "integer" ? "numeric" : f.kind === "url" ? "url" : "text") as "text"}
            maxLength={f.max_length}
            autoCapitalize="off"
            onInput={(e) => onChange(e.currentTarget.value)}
          />
        )}
      </div>
      {isLines ? <p class="note" style="margin:0">{t("form.linesNote")}</p> : null}
    </div>
  );
}
