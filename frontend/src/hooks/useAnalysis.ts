import { useState, useCallback, useEffect } from 'react';
import apiClient, {
  AnalysisResponse,
  AnalysisStatusResponse,
  ImageUploadResponse,
  ApiError,
} from '../services/apiClient';

interface AnalysisState {
  sessionId: string | null;
  uploadedImages: ImageUploadResponse | null;
  analysisResult: AnalysisResponse | null;
  isUploading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  progress: number;
}

interface UseAnalysisReturn extends AnalysisState {
  initializeSession: () => Promise<void>;
  uploadImages: (files: File[]) => Promise<void>;
  analyzeImages: (prompt: string) => Promise<void>;
  exportResult: (format: 'json' | 'markdown' | 'txt') => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useAnalysis = (): UseAnalysisReturn => {
  const [state, setState] = useState<AnalysisState>({
    sessionId: null,
    uploadedImages: null,
    analysisResult: null,
    isUploading: false,
    isAnalyzing: false,
    error: null,
    progress: 0,
  });

  // 세션 초기화
  const initializeSession = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, error: null }));

      const session = await apiClient.initializeSession();

      setState((prev) => ({
        ...prev,
        sessionId: session.sessionId,
      }));
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        error: apiError.message || '세션 초기화에 실패했습니다.',
      }));
    }
  }, []);

  // 컴포넌트 마운트 시 세션 초기화
  useEffect(() => {
    initializeSession();
  }, [initializeSession]);

  // 이미지 업로드
  const uploadImages = useCallback(async (files: File[]) => {
    if (!state.sessionId) {
      setState((prev) => ({
        ...prev,
        error: '세션이 초기화되지 않았습니다. 페이지를 새로고침해주세요.',
      }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isUploading: true,
        error: null,
        progress: 0,
      }));

      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 200);

      const response = await apiClient.uploadImages(files, state.sessionId);

      clearInterval(progressInterval);

      setState((prev) => ({
        ...prev,
        uploadedImages: response,
        isUploading: false,
        progress: 100,
      }));

      // 진행률 초기화
      setTimeout(() => {
        setState((prev) => ({ ...prev, progress: 0 }));
      }, 1000);
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        isUploading: false,
        progress: 0,
        error: apiError.message || '이미지 업로드에 실패했습니다.',
      }));
    }
  }, [state.sessionId]);

  // 이미지 분석 (이미지 없이 텍스트만으로도 가능)
  const analyzeImages = useCallback(async (prompt: string) => {
    if (!state.sessionId) {
      setState((prev) => ({
        ...prev,
        error: '세션이 초기화되지 않았습니다.',
      }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isAnalyzing: true,
        error: null,
        progress: 0,
        analysisResult: null,
      }));

      // 이미지가 있으면 imageIds 전달, 없으면 빈 배열 또는 생략
      const imageIds = state.uploadedImages?.images.map((img) => img.id) || [];

      // 진행률 시뮬레이션
      const progressInterval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 5, 90),
        }));
      }, 500);

      const response = await apiClient.analyzeImages({
        sessionId: state.sessionId,
        imageIds,
        prompt,
      });

      console.log('🔍 Analysis Response:', response);

      clearInterval(progressInterval);

      // 응답이 AnalysisStatusResponse인 경우 (202) - 폴링 시작
      if ('status' in response && response.status !== 'completed') {
        console.log('⏳ Status is not completed, starting polling');
        const statusResponse = response as AnalysisStatusResponse;
        pollAnalysisStatus(statusResponse.requestId);
      } else {
        // 즉시 완료된 경우 (200)
        console.log('✅ Analysis completed immediately:', response);
        const analysisResponse = response as AnalysisResponse;
        setState((prev) => ({
          ...prev,
          analysisResult: analysisResponse,
          isAnalyzing: false,
          progress: 100,
        }));

        // 진행률 초기화
        setTimeout(() => {
          setState((prev) => ({ ...prev, progress: 0 }));
        }, 1000);
      }
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        isAnalyzing: false,
        progress: 0,
        error: apiError.message || '분석 요청에 실패했습니다.',
      }));
    }
  }, [state.sessionId, state.uploadedImages]);

  // 분석 상태 폴링
  const pollAnalysisStatus = async (requestId: string) => {
    const maxAttempts = 60; // 최대 60회 (30초)
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          progress: 0,
          error: '분석 시간이 초과되었습니다. 다시 시도해주세요.',
        }));
        return;
      }

      attempts++;

      try {
        const response = await apiClient.getAnalysisResult(requestId);

        if ('status' in response && response.status === 'completed') {
          const analysisResponse = response as AnalysisResponse;
          setState((prev) => ({
            ...prev,
            analysisResult: analysisResponse,
            isAnalyzing: false,
            progress: 100,
          }));

          setTimeout(() => {
            setState((prev) => ({ ...prev, progress: 0 }));
          }, 1000);
        } else {
          // 아직 처리 중
          const statusResponse = response as AnalysisStatusResponse;
          if (statusResponse.progressPercent !== undefined) {
            setState((prev) => ({
              ...prev,
              progress: statusResponse.progressPercent!,
            }));
          }
          setTimeout(poll, 500); // 0.5초 후 재시도
        }
      } catch (error) {
        const apiError = error as ApiError;
        setState((prev) => ({
          ...prev,
          isAnalyzing: false,
          progress: 0,
          error: apiError.message || '분석 상태 조회에 실패했습니다.',
        }));
      }
    };

    poll();
  };

  // 결과 내보내기
  const exportResult = useCallback(async (format: 'json' | 'markdown' | 'txt') => {
    if (!state.analysisResult) {
      setState((prev) => ({
        ...prev,
        error: '내보낼 분석 결과가 없습니다.',
      }));
      return;
    }

    try {
      const data = await apiClient.exportAnalysis(state.analysisResult.requestId, format);

      // 파일 다운로드
      const blob = new Blob(
        [typeof data === 'string' ? data : JSON.stringify(data, null, 2)],
        {
          type:
            format === 'json'
              ? 'application/json'
              : format === 'markdown'
              ? 'text/markdown'
              : 'text/plain',
        }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analysis-${state.analysisResult.requestId.substring(0, 8)}.${format === 'markdown' ? 'md' : format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const apiError = error as ApiError;
      setState((prev) => ({
        ...prev,
        error: apiError.message || '결과 내보내기에 실패했습니다.',
      }));
    }
  }, [state.analysisResult]);

  // 에러 초기화
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // 전체 초기화
  const reset = useCallback(() => {
    setState({
      sessionId: state.sessionId, // 세션은 유지
      uploadedImages: null,
      analysisResult: null,
      isUploading: false,
      isAnalyzing: false,
      error: null,
      progress: 0,
    });
  }, [state.sessionId]);

  return {
    ...state,
    initializeSession,
    uploadImages,
    analyzeImages,
    exportResult,
    clearError,
    reset,
  };
};

export default useAnalysis;
