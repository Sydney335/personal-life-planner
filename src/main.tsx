import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";
import { updates } from "./updates";
createRoot(document.getElementById("root")!).render(<App />);
updates.start();
