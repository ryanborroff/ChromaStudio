import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// Root /api handler — returns 200 so uptime monitors pinging /api don't
// false-positive on the 404 that Express returns for an unregistered base path.
router.get("/", (_req, res) => {
  res.json({ ok: true });
});

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
