import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FengBroWorkspace } from "./routes/index";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FengBroWorkspace />
  </StrictMode>,
);
