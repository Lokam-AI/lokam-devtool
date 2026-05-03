import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiGetThread,
  apiPostMessage,
  apiEditMessage,
  apiDeleteMessage,
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiGetMentionableUsers,
} from "@/lib/api";
import type { Attachment } from "@/types";

const THREAD_POLL_MS = 30_000;
const NOTIFICATION_POLL_MS = 60_000;

function threadKey(entityType: string, entityId: number) {
  return ["thread", entityType, entityId] as const;
}

export function useThread(entityType: string, entityId: number | null) {
  return useQuery({
    queryKey: ["thread", entityType, entityId],
    queryFn: () => apiGetThread(entityType, entityId!),
    enabled: entityId != null,
    refetchInterval: THREAD_POLL_MS,
    staleTime: 0,
  });
}

export function usePostMessage(entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ body, attachments }: { body: string; attachments?: Attachment[] }) =>
      apiPostMessage(entityType, entityId, body, attachments),
    onSuccess: () => qc.invalidateQueries({ queryKey: threadKey(entityType, entityId) }),
  });
}

export function useEditMessage(entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }: { messageId: number; body: string }) =>
      apiEditMessage(messageId, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: threadKey(entityType, entityId) }),
  });
}

export function useDeleteMessage(entityType: string, entityId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (messageId: number) => apiDeleteMessage(messageId),
    onSuccess: () => qc.invalidateQueries({ queryKey: threadKey(entityType, entityId) }),
  });
}

export function useMentionableUsers() {
  return useQuery({
    queryKey: ["mentionable-users"],
    queryFn: apiGetMentionableUsers,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: apiGetNotifications,
    refetchInterval: NOTIFICATION_POLL_MS,
    staleTime: 0,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiMarkNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: apiMarkAllNotificationsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
