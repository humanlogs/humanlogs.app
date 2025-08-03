import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app";
import { QueryClientProvider } from "react-query";
import { queryClient } from "./features/query";

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
