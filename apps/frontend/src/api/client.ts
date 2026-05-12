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
      const token = localStorage.getItem('sara_token') || '';
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      };

      const options: RequestInit = {
        method,
        headers,
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
  async getCases(params?: { modality?: string; difficulty?: string; search?: string; page?: number; is_valid?: string }) {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : '';
    return this.request<any>(`/cases/${queryString ? '?' + queryString : ''}`);
  }

  async getExamCases() {
    return this.request<any>('/exam-cases/');
  }

  async getCaseDetail(caseId: string) {
    return this.request<any>(`/cases/${caseId}/`);
  }

  async getTags() {
    return this.request<any>('/tags/');
  }

  // Sessions
  async getSessions(params?: { status?: string; page?: number; case?: string }) {
    const queryString = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString() : '';
    return this.request<any>(`/sessions/${queryString ? '?' + queryString : ''}`);
  }

  async resumeSession(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}/resume/`, 'POST');
  }

  async createSession(caseId: string) {
    return this.request<any>('/sessions/', 'POST', { case_id: caseId });
  }

  async getSessionDetail(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}/`);
  }

  async submitAnswer(sessionId: string, studentAnswer: string) {
    return this.request<any>(`/sessions/${sessionId}/submit_answer/`, 'POST', { student_answer: studentAnswer });
  }

  async getAnswerKey(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}/answer_key/`);
  }

  async getStepAnswers(sessionId: string | number) {
    return this.request<any>(`/sessions/${sessionId}/step_answers/`);
  }

  async exitSession(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}/exit_session/`, 'POST');
  }

  async deleteSession(sessionId: string) {
    return this.request<any>(`/sessions/${sessionId}/`, 'DELETE');
  }

  // Uploaded cases
  async getUploadedCases() {
    return this.request<any>('/uploaded-cases/');
  }

  async uploadCase(formData: FormData): Promise<ApiResponse<any>> {
    try {
      const token = localStorage.getItem('sara_token') || '';
      const response = await fetch(`${this.baseURL}/uploaded-cases/`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { status: response.status, error: errorData.error || `HTTP ${response.status}` };
      }
      const data = await response.json();
      return { data, status: response.status };
    } catch (error) {
      return { status: 0, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deleteUploadedCase(uploadSessionId: string) {
    return this.request<any>(`/uploaded-cases/${uploadSessionId}/`, 'DELETE');
  }

  async getUploadedCaseFindings(uploadSessionId: string) {
    return this.request<any>(`/uploaded-cases/${uploadSessionId}/findings/`);
  }

  // Swap debate
  async listSwapSessions() {
    return this.request<any>('/swap-sessions/');
  }

  async createSwapSession(caseId: string) {
    return this.request<any>('/swap-sessions/', 'POST', { case_id: caseId });
  }

  async getSwapSession(sessionId: string) {
    return this.request<any>(`/swap-sessions/${sessionId}/`);
  }

  async sendSwapMessage(sessionId: string, message: string) {
    return this.request<any>(`/swap-sessions/${sessionId}/messages/`, 'POST', { message });
  }

  async streamSwapMessage(
    sessionId: string,
    message: string,
    onDelta: (delta: string) => void
  ) {
    const token = localStorage.getItem('sara_token') || '';
    const response = await fetch(`${this.baseURL}/swap-sessions/${sessionId}/messages_stream/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok || !response.body) {
      const errorData = await response.json().catch(() => ({}));
      return { error: errorData.error || `HTTP ${response.status}`, status: response.status };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const eventBlock of events) {
        const eventLine = eventBlock.split('\n').find(line => line.startsWith('event: '));
        const dataLine = eventBlock.split('\n').find(line => line.startsWith('data: '));
        if (!eventLine || !dataLine) continue;
        const event = eventLine.slice(7).trim();
        const payload = JSON.parse(dataLine.slice(6));
        if (event === 'delta') {
          onDelta(payload.delta ?? '');
        } else if (event === 'done') {
          return { data: payload.session, status: 200 };
        } else if (event === 'error') {
          return { error: payload.error || 'Stream failed', status: 500 };
        }
      }
    }

    return { error: 'Stream ended before completion', status: 0 };
  }

  // Exam
  async createExamSession(caseId: string) {
    return this.request<any>('/exam-sessions/', 'POST', { case_id: caseId });
  }

  async getExamSession(sessionId: string) {
    return this.request<any>(`/exam-sessions/${sessionId}/`);
  }

  async submitExamStep(sessionId: string, stepIndex: number, answer: string, timeSpentSeconds: number) {
    return this.request<any>(`/exam-sessions/${sessionId}/submit_step/`, 'POST', {
      step_index: stepIndex,
      answer,
      time_spent_seconds: timeSpentSeconds,
    });
  }

  async completeExamSession(sessionId: string) {
    return this.request<any>(`/exam-sessions/${sessionId}/complete/`, 'POST');
  }

  async getExamReview(sessionId: string) {
    return this.request<any>(`/exam-sessions/${sessionId}/review/`);
  }

  // Performance
  async getMyStats() {
    return this.request<any>('/performance/my_stats/');
  }
}

export const apiClient = new APIClient();
