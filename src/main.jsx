import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ComercialPage from "./comercial/ComercialPage";
import "./index.css";

const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
const RootComponent = currentPath.startsWith("/comercial") ? ComercialPage : App;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootComponent />
  </React.StrictMode>
);
