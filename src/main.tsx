import { render } from "preact";
import { App } from "./app";
import { initTelegram } from "./tg";
import "./styles.css";

initTelegram();
render(<App />, document.getElementById("app")!);
