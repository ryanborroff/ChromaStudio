import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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
   * Generate a presigned PUT URL for a new private upload.
   * Returns a signed R2 URL; call normalizeObjectEntityPath() to get the
   * internal /objects/<key> path to store in the database.
   *
   * Keys are currently flat under private/uploads/<uuid> since there is no
   * transcode/derivative pipeline in this codebase today (renditions are
   * generated externally by the streaming provider, when one is configured).
   * If a derivatives pipeline is ever added, split keys into
   * private/originals/<uuid> (write-once, never overwritten) and
   * private/derivatives/<uuid>/<variant> (regenerable) — and make sure any
   * purge job only ever deletes originals/-scoped keys tied to a specific
   * soft-deleted row, never a blanket prefix delete.
   */
  async getObjectEntityUploadURL(ownerUserId?: string, metadata?: { originalFilename: string; contentType: string }): Promise<string> {
    const key = `${PRIVATE_PREFIX}/uploads/${randomUUID()}`;
    // Write the owner ACL before issuing a client-accessible upload URL.
    // Fail closed if ACL persistence fails.
    if (ownerUserId) {
      await setObjectAclPolicy({ key }, { owner: ownerUserId, visibility: "private" });
    }
    const command = new PutObjectCommand({
      Bucket: getR2Bucket(), Key: key,
      ...(metadata ? { ContentType: metadata.contentType, Metadata: { "original-filename": encodeURIComponent(metadata.originalFilename) } } : {}),
    });
    return getSignedUrl(getR2Client(), command, { expiresIn: 900 });
  }

  /**
   * Generate a short-lived presigned GET URL for downloading an object.
   * Callers must run their own access-control check before calling this —
   * anyone holding the URL can read the object until it expires.
   */
  async getObjectEntityDownloadURL(
    ref: R2ObjectRef,
    opts?: { responseContentDisposition?: string; responseContentType?: string },
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: getR2Bucket(),
      Key: ref.key,
      ResponseContentDisposition: opts?.responseContentDisposition,
      ResponseContentType: opts?.responseContentType,
    });
    return getSignedUrl(getR2Client(), command, { expiresIn: 120 });
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

  /**
   * Re-fetch an uploaded object's metadata from R2 to confirm it actually
   * landed before marking a video "ready". Throws ObjectNotFoundError if
   * the object is missing.
   */
  async verifyObjectUpload(
    objectPath: string,
  ): Promise<{ key: string; sizeBytes: number; contentType: string | null; originalFilename: string | null }> {
    const { key } = await this.getObjectEntityFile(objectPath);
    const head = await getR2Client().send(
      new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    );
    if (head.ContentLength == null) {
      throw new ObjectNotFoundError();
    }
    return {
      key,
      sizeBytes: head.ContentLength,
      contentType: head.ContentType ?? null,
      originalFilename: head.Metadata?.["original-filename"] ? decodeURIComponent(head.Metadata["original-filename"]) : null,
    };
  }

  /**
   * Permanently delete an object from R2. Used by the video purge job once
   * a soft-deleted video's grace period has passed.
   */
  async deleteObject(key: string): Promise<void> {
    await getR2Client().send(
      new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: key }),
    );
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
