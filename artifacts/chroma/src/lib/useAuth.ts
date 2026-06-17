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

export function loginWithApple(): void {
  window.location.href = `${apiBase}/auth/apple`;
}

async function postAuth(
  path: string,
  body: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
}

export function registerWithEmail(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<void> {
  return postAuth("/auth/register", input);
}

export function loginWithEmail(input: {
  email: string;
  password: string;
}): Promise<void> {
  return postAuth("/auth/login", input);
}

export function loginWithDevPassword(password: string): Promise<void> {
  return postAuth("/auth/dev-login", { password });
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
