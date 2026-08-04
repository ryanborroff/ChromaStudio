import { Router, type IRouter } from "express";
import fs from "fs";
import path from "path";
import authRouter from "./auth";
import healthRouter from "./health";
import usersRouter from "./users";
import videosRouter from "./videos";
import collectionsRouter from "./collections";
import shareRouter from "./share";
import followsRouter from "./follows";
import feedRouter from "./feed";
import messagesRouter from "./messages";
import statsRouter from "./stats";
import storageRouter from "./storage";
import deliveriesRouter from "./deliveries";
import endorsementsRouter from "./endorsements";
import adminRouter from "./admin";
import webhooksRouter from "./webhooks";
import reviewRouter from "./review";
import exportsRouter from "./exports";
import portfolioRouter from "./portfolio";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(usersRouter);
router.use(videosRouter);
router.use(collectionsRouter);
router.use(shareRouter);
router.use(followsRouter);
router.use(feedRouter);
router.use(messagesRouter);
router.use(statsRouter);
router.use(storageRouter);
router.use(deliveriesRouter);
router.use(endorsementsRouter);
router.use(adminRouter);
router.use(webhooksRouter);
router.use(reviewRouter);
router.use(exportsRouter);
router.use(portfolioRouter);
router.use(analyticsRouter);

router.get("/download-source", (_req, res) => {
  const zipPath = path.resolve("/home/runner/workspace/chroma-src.zip");
  if (!fs.existsSync(zipPath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  res.setHeader("Content-Disposition", 'attachment; filename="chroma-src.zip"');
  res.setHeader("Content-Type", "application/zip");
  res.sendFile(zipPath);
});

export default router;
