import { http, HttpResponse } from "msw";
import {
  DEMO_USER,
  DEMO_AUTHORS,
  DEMO_VIDEOS,
  DEMO_COMMENTS,
  DEMO_PLATFORM_STATS,
} from "./data";

// All API paths from the generated client start with /api/
// MSW intercepts at the fetch level, so these match regardless of the Vite base path.

export const handlers = [
  // ── Auth / current user ──────────────────────────────────────────────────
  http.get("*/api/users/me", () => HttpResponse.json(DEMO_USER)),

  http.post("*/api/auth/logout", () =>
    HttpResponse.json({ ok: true }, { status: 200 }),
  ),

  // ── Videos — list ───────────────────────────────────────────────────────
  http.get("*/api/videos", ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.toLowerCase() ?? "";
    const sort = url.searchParams.get("sort") ?? "featured";
    const featuredOnly = url.searchParams.get("featured") === "true";
    const genre = url.searchParams.get("genre")?.toLowerCase() ?? "";

    let videos = [...DEMO_VIDEOS];

    if (search) {
      videos = videos.filter(
        (v) =>
          v.title.toLowerCase().includes(search) ||
          v.description?.toLowerCase().includes(search) ||
          v.tags.some((t) => t.includes(search)) ||
          v.user.name.toLowerCase().includes(search),
      );
    }

    if (genre) {
      videos = videos.filter((v) => v.tags.includes(genre));
    }

    if (featuredOnly) {
      videos = videos.filter((v) => v.isFeatured);
    }

    if (sort === "featured") {
      videos = videos.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
    } else if (sort === "newest") {
      videos = videos.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else if (sort === "most_viewed") {
      videos = videos.sort((a, b) => b.viewCount - a.viewCount);
    } else if (sort === "community_rated" || sort === "community_rated_asc") {
      videos = videos.sort((a, b) =>
        sort === "community_rated"
          ? (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0)
          : (a.ratingAvg ?? 0) - (b.ratingAvg ?? 0),
      );
    }

    const limit = Number(url.searchParams.get("limit") ?? 20);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const page = videos.slice(offset, offset + limit);

    return HttpResponse.json({ videos: page, total: videos.length });
  }),

  // ── Videos — feed ───────────────────────────────────────────────────────
  http.get("*/api/videos/feed", () => {
    // Return videos from followed authors (Andrés and Kai)
    const feedVideos = DEMO_VIDEOS.filter((v) => v.user.isFollowing);
    return HttpResponse.json({ videos: feedVideos, total: feedVideos.length });
  }),

  // ── Video — single ───────────────────────────────────────────────────────
  http.get("*/api/videos/:id", ({ params }) => {
    const id = Number(params.id);
    const video = DEMO_VIDEOS.find((v) => v.id === id);
    if (!video) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    return HttpResponse.json(video);
  }),

  // ── Video — like (toggle) ────────────────────────────────────────────────
  http.post("*/api/videos/:id/like", ({ params }) => {
    const id = Number(params.id);
    const video = DEMO_VIDEOS.find((v) => v.id === id);
    if (!video) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    const liked = !video.isLiked;
    video.isLiked = liked;
    video.likeCount += liked ? 1 : -1;
    return HttpResponse.json({ liked, likeCount: video.likeCount });
  }),

  // ── Video — rate ─────────────────────────────────────────────────────────
  http.post("*/api/videos/:id/rate", async ({ params, request }) => {
    const id = Number(params.id);
    const video = DEMO_VIDEOS.find((v) => v.id === id);
    if (!video) return HttpResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await request.json()) as { rating: number };
    const oldRating = video.userRating ?? 0;
    if (oldRating) {
      video.ratingSum = video.ratingSum - oldRating + body.rating;
    } else {
      video.ratingSum += body.rating;
      video.ratingCount += 1;
    }
    (video as { userRating: number | null }).userRating = body.rating;
    video.ratingAvg = video.ratingSum / video.ratingCount;
    return HttpResponse.json({
      ratingAvg: video.ratingAvg,
      ratingCount: video.ratingCount,
      userRating: video.userRating,
    });
  }),

  // ── Comments ─────────────────────────────────────────────────────────────
  http.get("*/api/videos/:id/comments", ({ params }) => {
    const id = Number(params.id);
    return HttpResponse.json(
      DEMO_COMMENTS[id] ?? { comments: [], total: 0 },
    );
  }),

  http.post("*/api/videos/:id/comments", async ({ params, request }) => {
    const id = Number(params.id);
    const body = (await request.json()) as { body: string };
    const comment = {
      id: Date.now(),
      videoId: id,
      userId: DEMO_USER.id,
      body: body.body,
      createdAt: new Date().toISOString(),
      user: DEMO_USER,
    };
    if (!DEMO_COMMENTS[id]) DEMO_COMMENTS[id] = { comments: [], total: 0 };
    (DEMO_COMMENTS[id].comments as unknown[]).push(comment);
    DEMO_COMMENTS[id].total += 1;
    return HttpResponse.json(comment, { status: 201 });
  }),

  // ── Review comments ───────────────────────────────────────────────────────
  http.get("*/api/videos/:id/review-comments", () =>
    HttpResponse.json({ comments: [], total: 0 }),
  ),

  // ── User profiles ─────────────────────────────────────────────────────────
  http.get("*/api/users/:username", ({ params }) => {
    const username = params.username as string;

    // Own profile
    if (username === DEMO_USER.username || username === "me") {
      return HttpResponse.json({
        user: DEMO_USER,
        videos: [],
        credits: [],
      });
    }

    const author = DEMO_AUTHORS.find((a) => a.username === username);
    if (!author) {
      return HttpResponse.json({ error: "User not found" }, { status: 404 });
    }

    const videos = DEMO_VIDEOS.filter((v) => v.userId === author.id);
    return HttpResponse.json({ user: author, videos, credits: [] });
  }),

  // ── User endorsements ────────────────────────────────────────────────────
  http.get("*/api/users/:userId/endorsements", () =>
    HttpResponse.json({ endorsements: [], total: 0, myEndorsement: null }),
  ),

  // ── Follows ───────────────────────────────────────────────────────────────
  http.post("*/api/users/:userId/follow", ({ params }) => {
    const userId = Number(params.userId);
    const author = DEMO_AUTHORS.find((a) => a.id === userId);
    if (author) {
      author.isFollowing = !author.isFollowing;
      if (author.isFollowing) author.followerCount += 1;
      else author.followerCount -= 1;
    }
    return HttpResponse.json({ following: author?.isFollowing ?? true });
  }),

  // ── Platform stats ────────────────────────────────────────────────────────
  http.get("*/api/stats", () => HttpResponse.json(DEMO_PLATFORM_STATS)),

  // ── Messages (empty inbox) ────────────────────────────────────────────────
  http.get("*/api/messages", () =>
    HttpResponse.json({ conversations: [], total: 0 }),
  ),
  http.get("*/api/messages/:userId", () =>
    HttpResponse.json({ messages: [], total: 0 }),
  ),

  // ── Collections ───────────────────────────────────────────────────────────
  http.get("*/api/collections", () =>
    HttpResponse.json({ collections: [], total: 0 }),
  ),

  // ── Storage ───────────────────────────────────────────────────────────────
  http.get("*/api/storage/usage", () =>
    HttpResponse.json({
      totalBytesUsed: 0,
      videoCount: 0,
      planStorageLimitBytes: 100 * 1024 * 1024 * 1024,
      usagePercent: 0,
      warning: false,
    }),
  ),

  // ── Upload (no-op in demo) ────────────────────────────────────────────────
  http.post("*/api/videos/upload-url", () =>
    HttpResponse.json(
      { error: "Upload is disabled in demo mode." },
      { status: 403 },
    ),
  ),

  http.post("*/api/storage/uploads/request-url", () =>
    HttpResponse.json(
      { error: "Upload is disabled in demo mode." },
      { status: 403 },
    ),
  ),

  // ── Admin users ───────────────────────────────────────────────────────────
  http.get("*/api/admin/users", () =>
    HttpResponse.json({ users: [], total: 0 }),
  ),

  // ── Deliveries ────────────────────────────────────────────────────────────
  http.get("*/api/deliveries", () =>
    HttpResponse.json({ deliveries: [], total: 0 }),
  ),

  // ── Exports ───────────────────────────────────────────────────────────────
  http.get("*/api/exports", () =>
    HttpResponse.json([]),
  ),
];
