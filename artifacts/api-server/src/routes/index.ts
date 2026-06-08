import { Router, type IRouter } from "express";
import authRouter from "./auth";
import healthRouter from "./health";
import usersRouter from "./users";
import videosRouter from "./videos";
import followsRouter from "./follows";
import feedRouter from "./feed";
import messagesRouter from "./messages";
import projectsRouter from "./projects";
import statsRouter from "./stats";
import storageRouter from "./storage";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(usersRouter);
router.use(videosRouter);
router.use(followsRouter);
router.use(feedRouter);
router.use(messagesRouter);
router.use(projectsRouter);
router.use(statsRouter);
router.use(storageRouter);

export default router;
