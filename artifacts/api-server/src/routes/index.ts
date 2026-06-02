import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import videosRouter from "./videos";
import followsRouter from "./follows";
import feedRouter from "./feed";
import messagesRouter from "./messages";
import projectsRouter from "./projects";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(videosRouter);
router.use(followsRouter);
router.use(feedRouter);
router.use(messagesRouter);
router.use(projectsRouter);
router.use(statsRouter);

export default router;
