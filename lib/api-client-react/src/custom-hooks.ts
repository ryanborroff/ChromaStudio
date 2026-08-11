/**
 * Custom (non-generated) hooks that extend the generated API client.
 * Add manually-managed endpoints here when they are not yet in the OpenAPI spec.
 */
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

// ---------------------------------------------------------------------------
// POST /api/videos/:id/confirm-upload
// ---------------------------------------------------------------------------

/**
 * Server-side trusted path to mark an object-storage video as "ready".
 * Must be called after a successful direct object-storage PUT upload instead
 * of PATCHing streamStatus directly.
 */
export const confirmVideoUpload = async (id: number): Promise<unknown> => {
  return customFetch<unknown>(`/api/videos/${id}/confirm-upload`, {
    method: "POST",
  });
};

export const useConfirmVideoUpload = <
  TError = unknown,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof confirmVideoUpload>>,
    TError,
    { id: number },
    TContext
  >;
}): UseMutationResult<
  Awaited<ReturnType<typeof confirmVideoUpload>>,
  TError,
  { id: number },
  TContext
> => {
  return useMutation({
    mutationKey: ["confirmVideoUpload"],
    mutationFn: ({ id }: { id: number }) => confirmVideoUpload(id),
    ...options?.mutation,
  });
};
