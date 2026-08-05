import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

async function bootstrap() {
  if (import.meta.env.VITE_DEMO_MODE === "true") {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      onUnhandledRequest: "bypass", // let non-mocked requests pass through silently
      serviceWorker: {
        url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
      },
    });
    console.info("[ChromaStudio] 🎬 Demo mode active — API calls intercepted by MSW");
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();
