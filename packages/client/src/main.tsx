import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "@fontsource-variable/jost";
import "@fontsource-variable/unbounded";
import "./index.css";
import { registerServiceWorker } from "./pwa/install.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

registerServiceWorker();
