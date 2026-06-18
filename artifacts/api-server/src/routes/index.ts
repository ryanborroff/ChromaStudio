import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import usersRouter from "./users";
import videosRouter from "./videos";
import collectionsRouter from "./collections";
import shareRouter from "./share";
import followsRouter from "./follows";
import feedRouter from "./feed";
import messagesRouter from "./messages";
import projectsRouter from "./projects";
import statsRouter from "./stats";
import storageRouter from "./storage";
import deliveriesRouter from "./deliveries";
import endorsementsRouter from "./endorsements";
import adminRouter from "./admin";

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
router.use(projectsRouter);
router.use(statsRouter);
router.use(storageRouter);
router.use(deliveriesRouter);
router.use(endorsementsRouter);
router.use(adminRouter);

export default router;
