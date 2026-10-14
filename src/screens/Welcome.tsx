import { useState } from "preact/hooks";
import type { Me } from "../../shared/types";
import { api } from "../api";
import { t } from "../i18n";
import { Icon, type IconName } from "../icons";
import { meStore } from "../store";
import { haptic } from "../tg";
import { BottomButtons, Sheet, errText, toast } from "../ui";

function Tilted({ slug, size, img, style }: { slug: string; size: number; img: number; style: string }) {
  return (
    <span class="logo" style={`width:${size}px;height:${size}px;border-radius:${size * 0.29}px;box-shadow:3px 6px 0 rgba(26,48,102,.1);${style}`}>
      <img src={`/platforms/${slug}.svg`} alt="" width={img} height={img} />
    </span>
  );
}

const FEATURES: [IconName, string, "welcome.f1" | "welcome.f2" | "welcome.f3"][] = [
  ["link", "var(--sky)", "welcome.f1"],
  ["star", "var(--lime)", "welcome.f2"],
  ["bell", "var(--pink)", "welcome.f3"],
];

export function Welcome() {
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState<string | null>(null);
  const accept = async () => {
    setBusy(true);
    try {
      const me = await api<Me>("/me", { method: "PATCH", body: { acceptTerms: true } });
      haptic.success();
      meStore.set(me);
    } catch (e) {
      toast(errText(e));
      setBusy(false);
    }
  };
  const legal = t("welcome.legal", { terms: "\u0000" }).split("\u0000");
  return (
    <div class="screen no-tabs" style="padding-top:20px;padding-bottom:140px;align-items:center;text-align:center">
      <div class="hero" aria-hidden="true">
        <span style="left:50px;top:16px;width:200px;height:200px;border-radius:999px;background:var(--sel)" />
        <span style="left:38px;top:4px;width:224px;height:224px;border-radius:999px;border:1.5px dashed var(--lavender-strong)" />
        <img src="/brand/mark.svg" alt="" width={104} height={104} style="left:98px;top:64px;filter:drop-shadow(4px 8px 0 rgba(26,48,102,.14))" />
        <Tilted slug="telegram" size={56} img={30} style="left:8px;top:34px;transform:rotate(-10deg)" />
        <Tilted slug="instagram" size={52} img={28} style="right:6px;top:22px;transform:rotate(9deg)" />
        <Tilted slug="youtube" size={50} img={28} style="left:22px;bottom:18px;transform:rotate(7deg)" />
        <Tilted slug="tiktok" size={56} img={28} style="right:20px;bottom:10px;transform:rotate(-8deg)" />
        <span style="right:84px;top:0;width:34px;height:34px;border-radius:11px;background:var(--lime);transform:rotate(12deg);display:flex;align-items:center;justify-content:center;color:var(--brand)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z" /></svg>
        </span>
      </div>
      <h1 class="display" style="font-size:30px;letter-spacing:-1.2px">{t("welcome.title")}</h1>
      <p class="sub" style="font-size:16px;line-height:1.45;max-width:300px;margin:-6px 0 0">{t("welcome.subtitle")}</p>
      <div style="display:flex;flex-direction:column;gap:14px;align-self:stretch;max-width:340px;margin:8px auto 0;text-align:start">
        {FEATURES.map(([icon, plate, key]) => (
          <div class="feature" key={key}>
            <span class="tile" style={`background:${plate}`}>
              <Icon name={icon} size={20} stroke={1.8} />
            </span>
            <span>{t(key)}</span>
          </div>
        ))}
      </div>
      <p class="sub" style="font-size:12px;margin:12px 0 0">
        {legal[0]}
        <button type="button" class="textbtn" style="height:auto;padding:0;font-size:12px" onClick={() => api<{ terms: string }>("/terms").then((r) => setTerms(r.terms))}>
          {t("welcome.terms")}
        </button>
        {legal[1]}
      </p>
      <BottomButtons main={{ text: t("welcome.continue"), onClick: accept, progress: busy, shine: true }} />
      {terms !== null ? (
        <Sheet title={t("welcome.terms")} onClose={() => setTerms(null)}>
          <p class="desc" style="padding:0 0 12px;text-align:start">{terms}</p>
        </Sheet>
      ) : null}
    </div>
  );
}
