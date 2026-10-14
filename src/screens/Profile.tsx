import { useEffect, useState } from "preact/hooks";
import { LANG_NAMES, LANGS } from "../../shared/types";
import { api } from "../api";
import { setLang, t } from "../i18n";
import { Icon } from "../icons";
import { updateMe } from "../me";
import { clearApiCache } from "../api";
import { meStore } from "../store";
import { haptic, homeScreen, isDark, openTelegramLink, requestWriteAccess } from "../tg";
import { Row, Sheet, Switch, errText, toast } from "../ui";

export function Profile() {
  const me = meStore.use()!;
  const [sheet, setSheet] = useState<"lang" | "terms" | null>(null);
  const [terms, setTerms] = useState("");
  const [home, setHome] = useState("unsupported");
  useEffect(() => {
    if (homeScreen.supported) homeScreen.status().then(setHome);
  }, []);

  const initials = ((me.firstName[0] ?? "") + (me.lastName[0] ?? "")).toUpperCase() || "?";

  const pickLang = async (l: string) => {
    setSheet(null);
    haptic.select();
    try {
      const m = await updateMe({ lang: l });
      clearApiCache();
      await setLang(m.lang);
    } catch (e) {
      toast(errText(e));
    }
  };

  const toggleNotify = async (on: boolean) => {
    try {
      if (on && !me.canMessage) {
        const ok = await requestWriteAccess();
        if (!ok) return toast(t("profile.notifyDenied"));
        await updateMe({ notify: true, canMessage: true });
      } else await updateMe({ notify: on });
    } catch (e) {
      toast(errText(e));
    }
  };

  const support = () => (me.supportUsername ? openTelegramLink(`https://t.me/${me.supportUsername}`) : me.botUsername ? openTelegramLink(`https://t.me/${me.botUsername}`) : undefined);

  return (
    <div class="screen">
      <div class="center" style="display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:10px">
        <span class="avatar">{me.photoUrl ? <img src={me.photoUrl} alt="" /> : initials}</span>
        <h1 class="xs" style="margin-top:6px">
          {me.firstName} {me.lastName}
        </h1>
        <span class="sub">{me.username ? `@${me.username} · ${t("profile.account")}` : t("profile.account")}</span>
      </div>

      <div class="card">
        <Row icon="globe" plate="var(--lavender-strong)" title={t("profile.language")} value={LANG_NAMES[me.lang]} onClick={() => setSheet("lang")} />
      </div>

      <div class="card">
        <Row icon="bell" plate="var(--pink)" title={t("profile.notify")} meta={t("profile.notifySub")} chevron={false}>
          <Switch on={me.notify && me.canMessage} label={t("profile.notify")} onChange={toggleNotify} />
        </Row>
        {homeScreen.supported ? (
          <Row
            icon="phone"
            plate="var(--lime)"
            title={t("profile.home")}
            value={home === "added" ? t("profile.homeAdded") : undefined}
            onClick={home === "added" ? undefined : () => homeScreen.add()}
            chevron={false}
          />
        ) : null}
        <Row icon="chat" plate="var(--sky)" title={t("profile.support")} onClick={support} />
        <Row
          icon="doc"
          plate="var(--lavender)"
          title={t("profile.terms")}
          onClick={() => {
            setSheet("terms");
            api<{ terms: string }>("/terms").then((r) => setTerms(r.terms));
          }}
        />
      </div>

      {me.isAdmin ? (
        <div class="section">
          <div class="card">
            <Row lead={<span class="tile sm" style="background:var(--brand);color:#fff"><Icon name="shield" size={18} /></span>} title={t("profile.admin")} href="/admin" />
          </div>
          <p class="note" style="margin:0">{t("profile.adminNote")}</p>
        </div>
      ) : null}

      <img src={isDark() ? "/brand/wordmark-dark.svg" : "/brand/wordmark-light.svg"} alt="NotPanel" height={22} style="align-self:center;margin-top:8px;opacity:.9" />

      {sheet === "lang" ? (
        <Sheet title={t("profile.language")} onClose={() => setSheet(null)}>
          <div class="card">
            {LANGS.map((l) => (
              <button type="button" class="row" key={l} onClick={() => pickLang(l)}>
                <span class="body" style="min-height:50px">
                  <span class="grow title" lang={l}>
                    {LANG_NAMES[l]}
                  </span>
                  <span style={`color:var(--acc);opacity:${l === me.lang ? 1 : 0}`}>
                    <Icon name="check" size={18} stroke={2.4} />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      {sheet === "terms" ? (
        <Sheet title={t("profile.terms")} onClose={() => setSheet(null)}>
          <p class="desc" style="padding:0 0 12px">{terms || t("common.loading")}</p>
        </Sheet>
      ) : null}
    </div>
  );
}
