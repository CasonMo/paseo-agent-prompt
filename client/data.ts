import { useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AgentId } from "../shared/agents";
import { hubGetStateRpc, hubHistoryRpc, hubRestoreRpc, hubSaveFileRpc, hubSyncSharedRpc, hubUpdateCheckRpc } from "../shared/hub";

const STATE_KEY = ["agent-prompt-hub", "state"] as const;

export function useHubState() {
  const call = useRpc(hubGetStateRpc);
  return useQuery({
    queryKey: STATE_KEY,
    queryFn: () => call({}),
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  });
}

export function useSaveFile() {
  const call = useRpc(hubSaveFileRpc);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSettled: () => queryClient.invalidateQueries({ queryKey: STATE_KEY }),
  });
}

export function useSyncShared() {
  const call = useRpc(hubSyncSharedRpc);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSettled: () => queryClient.invalidateQueries({ queryKey: STATE_KEY }),
  });
}

export function useHistory(target: AgentId | "shared" | null) {
  const call = useRpc(hubHistoryRpc);
  return useQuery({
    queryKey: ["agent-prompt-hub", "history", target ?? "none"],
    queryFn: () => {
      if (target === null) throw new Error("no history target");
      return call({ target });
    },
    enabled: target !== null,
    staleTime: 5_000,
  });
}

export function useRestore() {
  const call = useRpc(hubRestoreRpc);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSettled: () => queryClient.invalidateQueries({ queryKey: STATE_KEY }),
  });
}

export function useUpdateCheck() {
  const call = useRpc(hubUpdateCheckRpc);
  return useQuery({
    queryKey: ["agent-prompt-hub", "update-check"],
    queryFn: () => call({}),
    staleTime: 3_600_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}
