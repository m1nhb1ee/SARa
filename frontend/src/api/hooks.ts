/**
 * React Hooks for API calls - Smart AI Radiology
 * Giản lưới việc sử dụng API client trong components
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from './client';

interface UseQueryOptions {
  skip?: boolean;
  refetchInterval?: number;
}

export function useCases(params?: { modality?: string; difficulty?: string; search?: string; page?: number }, options?: UseQueryOptions) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const response = await apiClient.getCases(params);
    if (response.error) {
      setError(response.error);
      setData(null);
    } else {
      setData(response.data);
      setError(null);
    }
    setLoading(false);
  }, [JSON.stringify(params)]);

  useEffect(() => {
    if (options?.skip) return;
    fetch();

    if (options?.refetchInterval) {
      const interval = setInterval(fetch, options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetch, options?.skip, options?.refetchInterval]);

  return { data, loading, error, refetch: fetch };
}

export function useCaseDetail(caseId: number | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(!caseId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) return;

    const fetch = async () => {
      setLoading(true);
      const response = await apiClient.getCaseDetail(caseId);
      if (response.error) {
        setError(response.error);
        setData(null);
      } else {
        setData(response.data);
        setError(null);
      }
      setLoading(false);
    };

    fetch();
  }, [caseId]);

  return { data, loading, error };
}

export function useSessions(params?: { status?: string; page?: number }, options?: UseQueryOptions) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const response = await apiClient.getSessions(params);
    if (response.error) {
      setError(response.error);
      setData(null);
    } else {
      setData(response.data);
      setError(null);
    }
    setLoading(false);
  }, [JSON.stringify(params)]);

  useEffect(() => {
    if (options?.skip) return;
    fetch();

    if (options?.refetchInterval) {
      const interval = setInterval(fetch, options.refetchInterval);
      return () => clearInterval(interval);
    }
  }, [fetch, options?.skip, options?.refetchInterval]);

  return { data, loading, error, refetch: fetch };
}

export function useSessionDetail(sessionId: number | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(!sessionId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetch = async () => {
      setLoading(true);
      const response = await apiClient.getSessionDetail(sessionId);
      if (response.error) {
        setError(response.error);
        setData(null);
      } else {
        setData(response.data);
        setError(null);
      }
      setLoading(false);
    };

    fetch();
  }, [sessionId]);

  return { data, loading, error };
}

export function useCreateSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSession = useCallback(async (caseId: number) => {
    setLoading(true);
    const response = await apiClient.createSession(caseId);
    if (response.error) {
      setError(response.error);
      return null;
    }
    setError(null);
    return response.data;
  }, []);

  return { createSession, loading, error };
}

export function useSubmitAnswer() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitAnswer = useCallback(async (sessionId: number, studentAnswer: string) => {
    setLoading(true);
    const response = await apiClient.submitAnswer(sessionId, studentAnswer);
    if (response.error) {
      setError(response.error);
      return null;
    }
    setError(null);
    return response.data;
  }, []);

  return { submitAnswer, loading, error };
}

export function useGetAnswerKey(sessionId: number | null) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnswerKey = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const response = await apiClient.getAnswerKey(sessionId);
    if (response.error) {
      setError(response.error);
      setData(null);
    } else {
      setData(response.data);
      setError(null);
    }
    setLoading(false);
  }, [sessionId]);

  return { data, loading, error, fetch: fetchAnswerKey };
}

export function useMyStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const response = await apiClient.getMyStats();
      if (response.error) {
        setError(response.error);
        setData(null);
      } else {
        setData(response.data);
        setError(null);
      }
      setLoading(false);
    };

    fetch();
  }, []);

  return { data, loading, error };
}
