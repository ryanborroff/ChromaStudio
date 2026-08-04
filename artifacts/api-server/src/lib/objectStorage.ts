import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { getR2Client, getR2Bucket } from "./r2Client";
import {
  type ObjectAclPolicy,
  type ObjectPermission,
  type R2ObjectRef,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

const PRIVATE_PREFIX = "private";
const PUBLIC_PREFIX = "public";

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  /**
   * Search for a public object by file path.
   * Looks under the "public/" prefix in the R2 bucket.
   */
  async searchPublicObject(filePath: string): Promise<R2ObjectRef | null> {
    const key = `${PUBLIC_PREFIX}/${filePath}`;
    try {
      await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }));
      return { key };
    } catch {
      return null;
    }
  }

  /**
   * Download an R2 object and return it as a web Response for streaming.
   */
  async downloadObject(ref: R2ObjectRef, cacheTtlSec: number = 3600): Promise<Response> {
    const result = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: ref.key }),
    );

    const aclPolicy = await getObjectAclPolicy(ref);
    const isPublic = aclPolicy?.visibility === "public";

    const headers: Record<string, string> = {
      "Content-Type": result.ContentType ?? "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (result.ContentLength != null) {
      headers["Content-Length"] = String(result.ContentLength);
    }

    if (!result.Body) {
      return new Response(null, { headers });
    }

    // AWS SDK Body in Node.js is a Readable stream — convert to web ReadableStream.
    const webStream = Readable.toWeb(result.Body as Readable) as ReadableStream;
    return new Response(webStream, { headers });
  }

  /**
   * Generate a presigned PUT URL for a new private upload.
   * Returns a signed R2 URL; call normalizeObjectEntityPath() to get the
   * internal /objects/<key> path to store in the database.
   */
  async getObjectEntityUploadURL(): Promise<string> {
    const key = `${PRIVATE_PREFIX}/uploads/${randomUUID()}`;
    const command = new PutObjectCommand({ Bucket: getR2Bucket(), Key: key });
    return getSignedUrl(getR2Client(), command, { expiresIn: 900 });
  }

  /**
   * Convert an R2 presigned PUT URL (returned from getObjectEntityUploadURL)
   * to the internal /objects/<key> path stored in the database.
   *
   * R2 URL format: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>?…
   */
  normalizeObjectEntityPath(rawPath: string): string {
    try {
      const url = new URL(rawPath);
      if (!url.hostname.endsWith(".r2.cloudflarestorage.com")) {
        return rawPath;
      }
      // pathname = /<bucket>/<key...>
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length < 2) return rawPath;
      const key = parts.slice(1).join("/"); // strip bucket name
      return `/objects/${key}`;
    } catch {
      return rawPath;
    }
  }

  /**
   * Look up a stored object by its internal /objects/<key> path.
   * Throws ObjectNotFoundError if the object does not exist in R2.
   */
  async getObjectEntityFile(objectPath: string): Promise<R2ObjectRef> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const key = objectPath.slice("/objects/".length);
    if (!key) {
      throw new ObjectNotFoundError();
    }
    try {
      await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }));
    } catch {
      throw new ObjectNotFoundError();
    }
    return { key };
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }
    const objectRef = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectRef, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: R2ObjectRef;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    const { ObjectPermission } = await import("./objectAcl");
    return canAccessObject({
      userId,
      objectRef: objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}
