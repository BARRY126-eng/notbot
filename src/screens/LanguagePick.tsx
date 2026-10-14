import { useState } from "preact/hooks";
import { LANG_NAMES, LANGS, type Lang, type Me } from "../../shared/types";
import { api } from "../api";
import { setLang, t } from "../i18n";
import { Icon } from "../icons";
import { meStore } from "../store";
import { haptic } from "../tg";
import { BottomButtons, errText, toast } from "../ui";

/** First launch: pick the app language. Telegram's language is pre-selected; the screen previews each choice. */
export function LanguagePick() {
  const me = meStore.use()!;
  const [lang, setChoice] = useState<Lang>(me.lang);
  const [busy, setBusy] = useState(false);
  const pick = (l: Lang) => {
    haptic.select();
    setChoice(l);
    void setLang(l);
  };
  const save = async () => {
    setBusy(true);
    try {
      meStore.set(await api<Me>("/me", { method: "PATCH", body: { lang } }));
    } catch (e) {
      toast(errText(e));
      setBusy(false);
    }
  };
  return (
    <div class="screen no-tabs" style="padding-top:28px;padding-bottom:140px">
      <div class="center" style="display:flex;flex-direction:column;align-items:center;gap:10px">
        <span class="tile" style="width:64px;height:64px;border-radius:20px;background:var(--lavender-strong)">
          <Icon name="globe" size={32} stroke={1.7} />
        </span>
        <h1 class="sm">{t("lang.title")}</h1>
        <p class="sub" style="margin:0">{t("lang.sub")}</p>
      </div>
      <div class="card" role="radiogroup" aria-label={t("lang.title")}>
        {LANGS.map((l) => (
          <button type="button" role="radio" aria-checked={l === lang} class="row" key={l} onClick={() => pick(l)}>
            <span class="body" style="min-height:50px">
              <span class="grow title" lang={l}>
                {LANG_NAMES[l]}
              </span>
              <span style={`color:var(--acc);opacity:${l === lang ? 1 : 0}`}>
                <Icon name="check" size={20} stroke={2.4} />
              </span>
            </span>
          </button>
        ))}
      </div>
      <BottomButtons main={{ text: t("lang.continue"), onClick: save, progress: busy }} />
    </div>
  );
}
