import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
import { ApiError } from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";

const apiBase = `${import.meta.env.BASE_URL}api`;

/**
 * Auth state derived from the session-backed `GET /api/users/me` endpoint.
 * When signed out the request 401s (thrown as ApiError), so `user` is null.
 */
export function useAuth() {
  const { data, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: (failureCount, err) => {
        if (err instanceof ApiError && err.status === 401) return false;
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,
    },
  });

  const isUnauthorized = error instanceof ApiError && error.status === 401;

  return {
    user: (data ?? null) as User | null,
    isSignedIn: !!data,
    isLoaded: !isLoading,
    isLoading,
    isUnauthorized,
  };
}

export function loginWithGoogle(): void {
  window.location.href = `${apiBase}/auth/google`;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      credentials: "same-origin",
    });
  } finally {
    queryClient.clear();
    window.location.href = import.meta.env.BASE_URL || "/";
  }
}
