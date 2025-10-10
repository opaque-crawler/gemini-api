import axios, { AxiosInstance, AxiosError } from 'axios';

// API 응답 타입 정의
export interface SessionResponse {
  sessionId: string;
  createdAt: string;
  rateLimits: RateLimitStatus;
}

export interface RateLimitStatus {
  requestsPerMinute: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
  tokensPerMinute: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
  requestsPerDay: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

export interface ImageMetadata {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  dimensions: {
    width: number | null;
    height: number | null;
  };
}

export interface ImageUploadResponse {
  images: ImageMetadata[];
  totalSizeBytes: number;
  sessionId: string;
}

export interface AnalysisRequest {
  sessionId: string;
  imageIds: string[];
  prompt: string;
  language?: string;
}

export interface AnalysisResponse {
  id: string;
  requestId: string;
  status: 'completed' | 'partial' | 'failed';
  content: string;
  format: 'markdown' | 'plaintext';
  generatedImages?: Array<{
    mimeType: string;
    data: string; // base64 encoded
  }>;
}

export interface AnalysisStatusResponse {
  requestId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  estimatedCompletionTime?: string;
  progressPercent?: number;
}

export interface HistoryResponse {
  sessionId: string;
  analyses: AnalysisResponse[];
  totalCount: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
  message: string;
  details?: string[];
  timestamp?: string;
}

export interface RateLimitError extends ApiError {
  retryAfter: number;
  limits: RateLimitStatus;
}

class ApiClient {
  private client: AxiosInstance;
  private sessionId: string | null = null;

  constructor(baseURL: string = process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1') {
    this.client = axios.create({
      baseURL,
      timeout: 30000, // 30초 타임아웃
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // 요청 인터셉터: 세션 ID 자동 추가
    this.client.interceptors.request.use(
      (config) => {
        if (this.sessionId && config.headers) {
          config.headers['X-Session-ID'] = this.sessionId;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // 응답 인터셉터: 에러 처리
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response) {
          // 서버 응답이 있는 경우
          const apiError: ApiError = {
            error: error.response.data?.error || 'unknown_error',
            message: error.response.data?.message || error.message,
            details: error.response.data?.details,
            timestamp: error.response.data?.timestamp,
          };
          return Promise.reject(apiError);
        } else if (error.request) {
          // 요청은 보냈지만 응답이 없는 경우
          return Promise.reject({
            error: 'network_error',
            message: 'Network error. Please check your connection.',
          });
        } else {
          // 요청 설정 중 에러
          return Promise.reject({
            error: 'request_error',
            message: error.message,
          });
        }
      }
    );

    // 로컬스토리지에서 세션 ID 복원
    this.loadSession();
  }

  // 세션 관리
  private loadSession(): void {
    const savedSessionId = localStorage.getItem('sessionId');
    if (savedSessionId) {
      this.sessionId = savedSessionId;
    }
  }

  private saveSession(sessionId: string): void {
    this.sessionId = sessionId;
    localStorage.setItem('sessionId', sessionId);
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  // API 메서드들

  /**
   * 건강 체크
   */
  async healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  /**
   * 새 세션 생성
   */
  async createSession(): Promise<SessionResponse> {
    const response = await this.client.post<SessionResponse>('/session');
    this.saveSession(response.data.sessionId);
    return response.data;
  }

  /**
   * 이미지 업로드
   */
  async uploadImages(files: File[], sessionId?: string): Promise<ImageUploadResponse> {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('images', file);
    });

    formData.append('sessionId', sessionId || this.sessionId || '');

    const response = await this.client.post<ImageUploadResponse>('/images', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 60000, // 파일 업로드는 60초 타임아웃
    });

    return response.data;
  }

  /**
   * 이미지 분석 요청
   */
  async analyzeImages(request: AnalysisRequest): Promise<AnalysisResponse | AnalysisStatusResponse> {
    const response = await this.client.post<AnalysisResponse | AnalysisStatusResponse>(
      '/analyze',
      request
    );
    return response.data;
  }

  /**
   * 분석 상태/결과 조회
   */
  async getAnalysisResult(requestId: string): Promise<AnalysisResponse | AnalysisStatusResponse> {
    const response = await this.client.get<AnalysisResponse | AnalysisStatusResponse>(
      `/analyze/${requestId}`
    );
    return response.data;
  }

  /**
   * 세션 히스토리 조회
   */
  async getSessionHistory(sessionId?: string, limit: number = 10): Promise<HistoryResponse> {
    const sid = sessionId || this.sessionId;
    if (!sid) {
      throw new Error('No session ID available');
    }

    const response = await this.client.get<HistoryResponse>(
      `/session/${sid}/history`,
      {
        params: { limit },
      }
    );
    return response.data;
  }

  /**
   * 분석 결과 내보내기
   */
  async exportAnalysis(
    requestId: string,
    format: 'json' | 'markdown' | 'txt' = 'json'
  ): Promise<AnalysisResponse | string> {
    const response = await this.client.get(`/export/${requestId}`, {
      params: { format },
      responseType: format === 'json' ? 'json' : 'text',
    });
    return response.data;
  }

  /**
   * 세션 초기화
   */
  async initializeSession(): Promise<SessionResponse> {
    if (this.sessionId) {
      // 이미 세션이 있으면 검증
      try {
        await this.getSessionHistory();
        const response = await this.createSession(); // 임시로 새 세션 생성
        return response;
      } catch (error) {
        // 세션이 유효하지 않으면 새로 생성
        return this.createSession();
      }
    } else {
      return this.createSession();
    }
  }

  /**
   * 세션 삭제
   */
  clearSession(): void {
    this.sessionId = null;
    localStorage.removeItem('sessionId');
  }
}

// 싱글톤 인스턴스
const apiClient = new ApiClient();

export default apiClient;
