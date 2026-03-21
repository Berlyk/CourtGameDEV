const SITE_VERSION = "2.2"; // меняй число каждый раз, когда хочешь сбросить старые данные

const savedVersion = localStorage.getItem("site_version");

if (savedVersion !== SITE_VERSION) {
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem("site_version", SITE_VERSION);
}
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
