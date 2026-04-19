/**
 * API Client - Smart AI Radiology
 * Giao tiếp với backend Django REST API
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: number;
}

class APIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
    body?: any
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseURL}${endpoint}`;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      const options: RequestInit = {
        method,
        headers,
        credentials: 'include', // Include cookies for session auth
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          status: response.status,
          error: errorData.error || `HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      return {
        status: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Cases
  async getCases(params?: { modality?: string; difficulty?: string; search?: string; page?: number }) {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : '';
    return this.request<any>(`/cases/${queryString ? '?' + queryString : ''}`);
  }

  async getCaseDetail(caseId: number) {
    return this.request<any>(`/cases/${caseId}/`);
  }

  async getTags() {
    return this.request<any>('/tags/');
  }

  // Sessions
  async getSessions(params?: { status?: string; page?: number }) {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : '';
    return this.request<any>(`/sessions/${queryString ? '?' + queryString : ''}`);
  }

  async createSession(caseId: number) {
    return this.request<any>('/sessions/', 'POST', { case: caseId });
  }

  async getSessionDetail(sessionId: number) {
    return this.request<any>(`/sessions/${sessionId}/`);
  }

  async submitAnswer(sessionId: number, studentAnswer: string) {
    return this.request<any>(`/sessions/${sessionId}/submit_answer/`, 'POST', { student_answer: studentAnswer });
  }

  async getAnswerKey(sessionId: number) {
    return this.request<any>(`/sessions/${sessionId}/answer_key/`);
  }

  async exitSession(sessionId: number) {
    return this.request<any>(`/sessions/${sessionId}/exit_session/`, 'POST');
  }

  // Performance
  async getMyStats() {
    return this.request<any>('/performance/my_stats/');
  }
}

export const apiClient = new APIClient();
