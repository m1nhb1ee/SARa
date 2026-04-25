import { useState, useEffect, useCallback } from 'react';
import { apiClient } from './client';

// ── Generic primitives ────────────────────────────────────────────────────────

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function useQueryState<T>(): [QueryState<T>, (patch: Partial<QueryState<T>>) => void] {
  const [state, setState] = useState<QueryState<T>>({ data: null, loading: true, error: null });
  const patch = useCallback((p: Partial<QueryState<T>>) => setState((s) => ({ ...s, ...p })), []);
  return [state, patch];
}

async function resolveQuery<T>(
  apiFn: () => Promise<{ data?: T; error?: string }>,
  patch: (p: Partial<QueryState<T>>) => void
) {
  patch({ loading: true });
  const res = await apiFn();
  if (res.error) {
    patch({ error: res.error, data: null, loading: false });
  } else {
    patch({ data: res.data ?? null, error: null, loading: false });
  }
}

// ── Query hooks ───────────────────────────────────────────────────────────────

export function useCases(params?: { modality?: string; difficulty?: string; search?: string; page?: number }) {
  const [state, patch] = useQueryState<any>();
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => resolveQuery(() => apiClient.getCases(params), patch), [paramsKey]);

  useEffect(() => { refetch(); }, [paramsKey]);

  return { ...state, refetch };
}

export function useCaseDetail(caseId: string | null) {
  const [state, patch] = useQueryState<any>();

  useEffect(() => {
    if (!caseId) { patch({ loading: false }); return; }
    resolveQuery(() => apiClient.getCaseDetail(caseId), patch);
  }, [caseId]);

  return state;
}

export function useSessions(params?: { status?: string; page?: number }) {
  const [state, patch] = useQueryState<any>();
  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => resolveQuery(() => apiClient.getSessions(params), patch), [paramsKey]);

  useEffect(() => { refetch(); }, [paramsKey]);

  return { ...state, refetch };
}

export function useSessionDetail(sessionId: string | null) {
  const [state, patch] = useQueryState<any>();

  const refetch = useCallback(() => {
    if (!sessionId) { patch({ loading: false }); return Promise.resolve(); }
    return resolveQuery(() => apiClient.getSessionDetail(sessionId), patch);
  }, [sessionId]);

  useEffect(() => { refetch(); }, [sessionId]);

  return { ...state, refetch };
}

export function useMyStats() {
  const [state, patch] = useQueryState<any>();

  useEffect(() => { resolveQuery(() => apiClient.getMyStats(), patch); }, []);

  return state;
}

export function useGetAnswerKey(sessionId: string | null) {
  const [state, patch] = useQueryState<any>();

  const fetch = useCallback(() => {
    if (!sessionId) return Promise.resolve();
    return resolveQuery(() => apiClient.getAnswerKey(sessionId), patch);
  }, [sessionId]);

  return { ...state, fetch };
}

// ── Mutation hooks ────────────────────────────────────────────────────────────

function useMutation<TArgs extends unknown[], TResult>(
  mutationFn: (...args: TArgs) => Promise<{ data?: TResult; error?: string }>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (...args: TArgs): Promise<TResult | null> => {
    setLoading(true);
    const res = await mutationFn(...args);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return null;
    }
    setError(null);
    return res.data ?? null;
  }, []);

  return { mutate, loading, error };
}

export function useCreateSession() {
  const { mutate, loading, error } = useMutation((caseId: string) => apiClient.createSession(caseId));
  return { createSession: mutate, loading, error };
}

export function useSubmitAnswer() {
  const { mutate, loading, error } = useMutation((sessionId: string, answer: string) =>
    apiClient.submitAnswer(sessionId, answer)
  );
  return { submitAnswer: mutate, loading, error };
}

export function useExitSession() {
  const { mutate, loading, error } = useMutation((sessionId: string) => apiClient.exitSession(sessionId));
  return { exitSession: mutate, loading, error };
}
