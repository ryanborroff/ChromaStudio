import { Router, type IRouter } from "express";
import { eq, sql, desc, or } from "drizzle-orm";
import { db, messagesTable, usersTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { SendMessageBody, ListConversationsResponse, GetConversationResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /messages
router.get("/messages", requireAuth, async (req, res): Promise<void> => {
  const user = await getCurrentUser(req);

  // Get all distinct conversation partners
  const sent = await db
    .select({ partnerId: messagesTable.recipientId })
    .from(messagesTable)
    .where(eq(messagesTable.senderId, user.id));
  const received = await db
    .select({ partnerId: messagesTable.senderId })
    .from(messagesTable)
    .where(eq(messagesTable.recipientId, user.id));

  const partnerIds = [
    ...new Set([...sent.map((r) => r.partnerId), ...received.map((r) => r.partnerId)]),
  ];

  const conversations = await Promise.all(
    partnerIds.map(async (partnerId) => {
      const [partner] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, partnerId))
        .limit(1);

      const [lastMsg] = await db
        .select()
        .from(messagesTable)
        .where(
          sql`(${messagesTable.senderId} = ${user.id} AND ${messagesTable.recipientId} = ${partnerId}) OR (${messagesTable.senderId} = ${partnerId} AND ${messagesTable.recipientId} = ${user.id})`,
        )
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      const [unreadRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(messagesTable)
        .where(
          sql`${messagesTable.senderId} = ${partnerId} AND ${messagesTable.recipientId} = ${user.id} AND ${messagesTable.read} = false`,
        );

      return {
        userId: partnerId,
        user: partner
          ? {
              ...partner,
              skills: partner.skills ?? [],
              socialLinks: partner.socialLinks ?? null,
              followerCount: 0,
              followingCount: 0,
              videoCount: 0,
              isFollowing: false,
            }
          : null,
        lastMessage:
          lastMsg?.body?.trim()
            ? lastMsg.body
            : lastMsg?.attachmentName
              ? `📎 ${lastMsg.attachmentName}`
              : "",
        unreadCount: unreadRow?.count ?? 0,
        updatedAt: lastMsg?.createdAt ?? new Date(),
      };
    }),
  );

  res.json(ListConversationsResponse.parse({ conversations }));
});

// GET /messages/:userId
router.get("/messages/:userId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const partnerId = parseInt(rawId, 10);
  const user = await getCurrentUser(req);

  // Mark messages as read
  await db
    .update(messagesTable)
    .set({ read: true })
    .where(
      sql`${messagesTable.senderId} = ${partnerId} AND ${messagesTable.recipientId} = ${user.id}`,
    );

  const messages = await db
    .select()
    .from(messagesTable)
    .where(
      sql`(${messagesTable.senderId} = ${user.id} AND ${messagesTable.recipientId} = ${partnerId}) OR (${messagesTable.senderId} = ${partnerId} AND ${messagesTable.recipientId} = ${user.id})`,
    )
    .orderBy(messagesTable.createdAt);

  res.json(GetConversationResponse.parse({ messages }));
});

// POST /messages/:userId
router.post("/messages/:userId", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const recipientId = parseInt(rawId, 10);
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const body = parsed.data.body ?? "";
  const attachmentUrl = parsed.data.attachmentUrl ?? null;
  if (attachmentUrl && !/^\/api\/storage\/objects\//.test(attachmentUrl)) {
    res.status(400).json({ error: "Invalid attachment URL" });
    return;
  }
  const hasAttachment = !!attachmentUrl;
  if (!body.trim() && !hasAttachment) {
    res.status(400).json({ error: "A message must have text or a file attachment" });
    return;
  }
  const user = await getCurrentUser(req);
  const [message] = await db
    .insert(messagesTable)
    .values({
      senderId: user.id,
      recipientId,
      body,
      attachmentUrl,
      attachmentName: parsed.data.attachmentName ?? null,
      attachmentType: parsed.data.attachmentType ?? null,
      attachmentSize: parsed.data.attachmentSize ?? null,
    })
    .returning();
  res.status(201).json(message);
});

export default router;
