import { trpc } from "@/providers/trpc";
import { useCallback, useMemo } from "react";

export function useAuth() {
  const utils = trpc.useUtils();

  const {
    data: user,
    isLoading,
    error,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: !!localStorage.getItem("imessing_token"),
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      localStorage.removeItem("imessing_token");
      await utils.invalidate();
      window.location.reload();
    },
  });

  const logout = useCallback(() => {
    localStorage.removeItem("imessing_token");
    logoutMutation.mutate();
    window.location.reload();
  }, [logoutMutation]);

  return useMemo(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading,
      error,
      logout,
    }),
    [user, isLoading, error, logout],
  );
}
