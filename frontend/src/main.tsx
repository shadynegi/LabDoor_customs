import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initAnalytics } from "./lib/analytics";
import { initSentry } from "./lib/sentry";
import { initSearchConsoleVerification } from "./lib/searchConsole";
import "./index.css"; // if you have global CSS

initSentry();
initAnalytics();
initSearchConsoleVerification();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
