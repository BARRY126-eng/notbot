import { useEffect, useState } from "preact/hooks";
import { refreshMe } from "./me";
import { setLang, useLang } from "./i18n";
import { navigate, useRoute } from "./router";
import { meStore } from "./store";
import { startParam } from "./tg";
import { ErrorState, Skeleton, TabBar, Toasts } from "./ui";
import { Welcome } from "./screens/Welcome";
import { LanguagePick } from "./screens/LanguagePick";
import { Home } from "./screens/Home";
import { Categories } from "./screens/Categories";
import { Services } from "./screens/Services";
import { OrderForm } from "./screens/OrderForm";
import { OrderPlaced } from "./screens/OrderPlaced";
import { Orders } from "./screens/Orders";
import { OrderDetail } from "./screens/OrderDetail";
import { Wallet } from "./screens/Wallet";
import { TopUp } from "./screens/TopUp";
import { Profile } from "./screens/Profile";
import { AdminRoutes } from "./admin/AdminRoutes";

/** Deep links: t.me/<bot>?startapp=order_12 / s_2828 / wallet */
function routeFromStartParam(p: string | null): string | null {
  if (!p) return null;
  let m = /^order_(\d+)$/.exec(p);
  if (m) return `/order/${m[1]}`;
  m = /^s_(\d+)$/.exec(p);
  if (m) return `/s/${m[1]}`;
  if (p === "wallet" || p === "orders" || p === "profile") return `/${p}`;
  return null;
}

const TAB_PATHS = new Set(["/", "/orders", "/wallet", "/profile"]);

export function App() {
  useLang();
  const me = meStore.use();
  const route = useRoute();
  const [error, setError] = useState<unknown>(null);

  const load = () => {
    setError(null);
    refreshMe()
      .then((m) => setLang(m.lang))
      .catch(setError);
  };
  useEffect(() => {
    const deep = routeFromStartParam(startParam);
    if (deep && (location.hash === "" || location.hash === "#/")) navigate(deep, { replace: true });
    load();
  }, []);

  if (error) return <ErrorState error={error} onRetry={load} />;
  if (!me)
    return (
      <div class="screen">
        <Skeleton h={40} />
        <Skeleton h={220} />
        <Skeleton h={58} n={2} />
      </div>
    );
  if (!me.langChosen) return <LanguagePick />;
  if (!me.termsAccepted) return <Welcome />;

  const [a, b, c] = route.parts;
  let screen;
  if (route.path === "/") screen = <Home />;
  else if (a === "p" && b && c) screen = <Services platform={b} category={c} />;
  else if (a === "p" && b) screen = <Categories platform={b} />;
  else if (a === "s" && b) screen = <OrderForm serviceId={Number(b)} query={route.query} />;
  else if (a === "placed" && b) screen = <OrderPlaced orderId={Number(b)} />;
  else if (route.path === "/orders") screen = <Orders />;
  else if (a === "order" && b) screen = <OrderDetail orderId={Number(b)} />;
  else if (route.path === "/wallet") screen = <Wallet />;
  else if (route.path === "/topup") screen = <TopUp />;
  else if (route.path === "/profile") screen = <Profile />;
  else if (a === "admin" && me.isAdmin) screen = <AdminRoutes parts={route.parts.slice(1)} query={route.query} />;
  else screen = <Home />;

  return (
    <>
      {screen}
      {TAB_PATHS.has(route.path) ? <TabBar /> : null}
      <Toasts />
    </>
  );
}
