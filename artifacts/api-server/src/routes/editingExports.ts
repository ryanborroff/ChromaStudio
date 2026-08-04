import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, videosTable } from "@workspace/db";
import { requireAuth, getCurrentUser } from "../lib/auth";
import { getStreamingProvider } from "../lib/streaming/index.js";

const router: IRouter = Router();

function escapeXml(value: string): string {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

async function getSourceUrl(
  video: typeof videosTable.$inferSelect,
): Promise<string | null> {
  if (video.videoUrl) return video.videoUrl;
  if (!video.streamUid || video.streamStatus !== "ready") return null;
  const provider = getStreamingProvider();
  return (
    provider?.createExportUrl(video.streamUid, video.streamPlaybackId) ?? null
  );
}

router.get(
  "/videos/:id/editing-export",
  requireAuth,
  async (req, res): Promise<void> => {
    const user = await getCurrentUser(req);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "Unsupported editing export format" });
      return;
    }

    const [video] = await db
      .select()
      .from(videosTable)
      .where(and(eq(videosTable.id, id), eq(videosTable.userId, user.id)))
      .limit(1);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }

    const sourceUrl = await getSourceUrl(video);
    if (!sourceUrl) {
      res.status(400).json({ error: "Video is not ready for editing export" });
      return;
    }

    const duration = Math.max(video.duration ?? 1, 1);
    const title = escapeXml(video.title || `Video ${video.id}`);
    const fileName = `${(video.title || `video-${video.id}`).replace(/[^\w.-]+/g, "_")}.fcpxml`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="Chroma 1080p" frameDuration="100/2400s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
    <asset id="r2" name="${title}" src="${escapeXml(sourceUrl)}" start="0s" duration="${duration}s" hasVideo="1" format="r1"/>
  </resources>
  <library>
    <event name="Chroma">
      <project name="${title}">
        <sequence format="r1" duration="${duration}s" tcStart="0s" tcFormat="NDF">
          <spine>
            <asset-clip name="${title}" ref="r2" offset="0s" duration="${duration}s" start="0s"/>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>
`;

    res
      .status(200)
      .type("application/xml")
      .setHeader("Content-Disposition", `attachment; filename="${fileName}"`)
      .send(xml);
  },
);

export default router;
