import { Router, type IRouter } from "express";
import { eq, sql, desc, ilike } from "drizzle-orm";
import { db, projectsTable, usersTable, applicationsTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import {
  CreateProjectBody,
  UpdateProjectBody,
  ApplyToProjectBody,
  ListProjectsResponse,
  GetProjectResponse,
  UpdateProjectResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildProjectResponse(project: typeof projectsTable.$inferSelect) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, project.userId))
    .limit(1);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applicationsTable)
    .where(eq(applicationsTable.projectId, project.id));

  return {
    ...project,
    rolesNeeded: project.rolesNeeded ?? [],
    applicationCount: countRow?.count ?? 0,
    user: user
      ? {
          ...(({ googleId, appleId, email, passwordHash, ...safe }) => {
            void googleId;
            void appleId;
            void email;
            void passwordHash;
            return safe;
          })(user),
          skills: user.skills ?? [],
          socialLinks: user.socialLinks ?? null,
          followerCount: 0,
          followingCount: 0,
          videoCount: 0,
          isFollowing: false,
        }
      : null,
  };
}

// GET /projects
router.get("/projects", async (req, res): Promise<void> => {
  const { role, country, search, limit = "20", offset = "0" } = req.query as Record<string, string>;

  let projects = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.createdAt))
    .limit(parseInt(limit))
    .offset(parseInt(offset));

  if (search) {
    projects = projects.filter(
      (p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase()),
    );
  }
  if (country) {
    projects = projects.filter((p) => p.location?.toLowerCase().includes(country.toLowerCase()));
  }
  if (role) {
    projects = projects.filter((p) => p.rolesNeeded?.some((r) => r.toLowerCase().includes(role.toLowerCase())));
  }

  const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(projectsTable);
  const enriched = await Promise.all(projects.map(buildProjectResponse));

  res.json(ListProjectsResponse.parse({ projects: enriched, total: countRow?.count ?? 0 }));
});

// POST /projects
router.post("/projects", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const [project] = await db
    .insert(projectsTable)
    .values({ ...parsed.data, userId: user.id, rolesNeeded: parsed.data.rolesNeeded ?? [] })
    .returning();
  const full = await buildProjectResponse(project);
  res.status(201).json(full);
});

// GET /projects/:id
router.get("/projects/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id)).limit(1);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const full = await buildProjectResponse(project);
  res.json(GetProjectResponse.parse(full));
});

// PATCH /projects/:id
router.patch("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const [project] = await db
    .update(projectsTable)
    .set(parsed.data as Partial<typeof projectsTable.$inferInsert>)
    .where(sql`${projectsTable.id} = ${id} AND ${projectsTable.userId} = ${user.id}`)
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const full = await buildProjectResponse(project);
  res.json(UpdateProjectResponse.parse(full));
});

// DELETE /projects/:id
router.delete("/projects/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const user = await getCurrentUser(req);
  await db
    .delete(projectsTable)
    .where(sql`${projectsTable.id} = ${id} AND ${projectsTable.userId} = ${user.id}`);
  res.sendStatus(204);
});

// POST /projects/:id/apply
router.post("/projects/:id/apply", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  const parsed = ApplyToProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getCurrentUser(req);
  const [application] = await db
    .insert(applicationsTable)
    .values({ projectId: id, userId: user.id, message: parsed.data.message })
    .returning();
  res.status(201).json(application);
});

export default router;
