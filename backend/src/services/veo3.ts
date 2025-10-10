import { GoogleGenAI } from '@google/genai';
import { createLogger } from '../utils/logger';

const logger = createLogger('veo3');

// API 키 로드 확인
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  logger.error('GEMINI_API_KEY not found in environment variables');
} else {
  logger.info('GEMINI_API_KEY loaded for Veo3', {
    keyPrefix: apiKey.substring(0, 20) + '...',
    keyLength: apiKey.length
  });
}

// Veo3 API 클라이언트 초기화
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
});

export type VeoModel = 'veo-3.0-generate-001' | 'veo-3.0-fast-generate-001' | 'veo-2.0-generate-001';

export interface VideoGenerationOptions {
  prompt: string;
  model?: VeoModel;
  negativePrompt?: string;
  image?: {
    mimeType: string;
    data: string; // base64
  };
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  correlationId?: string;
}

export interface VideoOperation {
  operationId: string;
  done: boolean;
  name?: string;
  metadata?: any;
  response?: {
    generatedVideos?: Array<{
      video: {
        uri: string;
        mimeType: string;
      };
    }>;
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface VideoGenerationResult {
  operationId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  mimeType?: string;
  estimatedCompletionTime?: string;
  error?: string;
  operation?: any; // 전체 operation 객체 (상태 확인용)
}

/**
 * Veo3를 사용하여 동영상 생성 시작
 */
export async function startVideoGeneration(
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  const {
    prompt,
    model = 'veo-3.0-generate-001',
    negativePrompt,
    image,
    aspectRatio = '16:9',
    resolution = '720p',
    correlationId
  } = options;

  try {
    logger.info('Starting Veo3 video generation', {
      correlationId,
      model,
      promptLength: prompt.length,
      aspectRatio,
      resolution,
      hasImage: !!image,
      hasNegativePrompt: !!negativePrompt,
    });

    // Veo3 API 호출 구성
    const config: any = {
      aspectRatio,
      resolution,
    };

    if (negativePrompt) {
      config.negativePrompt = negativePrompt;
    }

    const requestParams: any = {
      model,
      prompt,
      config,
    };

    if (image) {
      requestParams.image = {
        imageBytes: image.data,
        mimeType: image.mimeType,
      };
    }

    logger.debug('Sending request to Veo3 API', {
      correlationId,
      model,
      hasImage: !!image,
      configKeys: Object.keys(config),
    });

    // API 호출 - operation 생성
    const operation = await ai.models.generateVideos(requestParams);

    const operationId = operation.name || 'unknown';

    logger.info('Veo3 video generation started', {
      correlationId,
      operationId,
      done: operation.done,
    });

    // 즉시 완료된 경우 처리
    if (operation.done) {
      const response = operation.response as any;

      // RAI 필터링 체크
      if (response?.generateVideoResponse?.raiMediaFilteredCount > 0) {
        const reasons = response.generateVideoResponse.raiMediaFilteredReasons || [];
        const errorMessage = reasons.join(', ') || 'Content filtered by responsible AI policy';

        logger.error('Veo3 video generation filtered by RAI (immediate)', {
          correlationId,
          operationId,
          filteredCount: response.generateVideoResponse.raiMediaFilteredCount,
          reasons,
        });

        return {
          operationId,
          status: 'failed',
          error: errorMessage,
          operation,
        };
      }

      // 성공적으로 비디오 생성된 경우
      if (response?.generateVideoResponse?.generatedSamples?.[0]) {
        const video = response.generateVideoResponse.generatedSamples[0].video;
        const result: VideoGenerationResult = {
          operationId,
          status: 'completed',
          operation,
        };

        if (video && video.uri) {
          const videoUrl = video.uri.includes('?')
            ? `${video.uri}&key=${apiKey}`
            : `${video.uri}?key=${apiKey}`;
          result.videoUrl = videoUrl;
          if (video.mimeType) {
            result.mimeType = video.mimeType;
          }
        }

        return result;
      }
    }

    // 처리 중인 경우
    return {
      operationId,
      status: 'processing',
      estimatedCompletionTime: new Date(Date.now() + 60000).toISOString(), // 1분 추정
      operation, // operation 객체 포함
    };

  } catch (error) {
    logger.error('Veo3 video generation failed', {
      correlationId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    throw error;
  }
}

/**
 * 동영상 생성 상태 확인 (REST API 직접 호출)
 */
export async function checkVideoStatus(
  storedOperation: any, // 저장된 operation 객체 사용
  correlationId?: string
): Promise<VideoGenerationResult> {
  try {
    logger.info('Checking Veo3 video generation status', {
      correlationId,
      operationId: storedOperation.name,
    });

    // REST API 직접 호출
    const operationName = storedOperation.name;
    const url = `https://generativelanguage.googleapis.com/v1beta/${operationName}`;

    const apiResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey || '',
      },
    });

    if (!apiResponse.ok) {
      throw new Error(`API request failed: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const operation: any = await apiResponse.json();

    logger.debug('Veo3 operation status retrieved', {
      correlationId,
      operationId: operation.name,
      done: operation.done,
      hasError: !!operation.error,
      operationStructure: JSON.stringify(operation, null, 2), // 전체 구조 확인
    });

    // 에러 처리
    if (operation.error) {
      logger.error('Veo3 video generation error', {
        correlationId,
        operationId: operation.name,
        errorCode: operation.error.code,
        errorMessage: operation.error.message,
      });

      return {
        operationId: operation.name,
        status: 'failed',
        error: operation.error.message,
        operation, // 업데이트된 operation 반환
      };
    }

    // RAI 필터링 처리 (done: true이지만 비디오가 생성되지 않은 경우)
    const response = operation.response as any;

    if (operation.done && response?.generateVideoResponse?.raiMediaFilteredCount > 0) {
      const reasons = response.generateVideoResponse.raiMediaFilteredReasons || [];
      const errorMessage = reasons.join(', ') || 'Content filtered by responsible AI policy';

      logger.error('Veo3 video generation filtered by RAI', {
        correlationId,
        operationId: operation.name,
        filteredCount: response.generateVideoResponse.raiMediaFilteredCount,
        reasons,
      });

      return {
        operationId: operation.name,
        status: 'failed',
        error: errorMessage,
        operation,
      };
    }

    // 완료된 경우 (성공적으로 비디오 생성)
    if (operation.done && response?.generateVideoResponse?.generatedSamples?.[0]) {
      const video = response.generateVideoResponse.generatedSamples[0].video;

      logger.info('Veo3 video generation completed', {
        correlationId,
        operationId: operation.name,
        videoUri: video?.uri,
        mimeType: video?.mimeType,
      });

      const result: VideoGenerationResult = {
        operationId: operation.name,
        status: 'completed',
        operation, // 업데이트된 operation 반환
      };

      if (video && video.uri) {
        // Google API URL에 API 키 추가 (CORS 문제 해결)
        const videoUrl = video.uri.includes('?')
          ? `${video.uri}&key=${apiKey}`
          : `${video.uri}?key=${apiKey}`;
        result.videoUrl = videoUrl;
        if (video.mimeType) {
          result.mimeType = video.mimeType;
        }
      }

      return result;
    }

    // 처리 중인 경우
    logger.info('Veo3 video generation in progress', {
      correlationId,
      operationId: operation.name,
    });

    return {
      operationId: operation.name,
      status: 'processing',
      estimatedCompletionTime: new Date(Date.now() + 60000).toISOString(),
      operation, // 업데이트된 operation 반환
    };

  } catch (error) {
    logger.error('Veo3 status check failed', {
      correlationId,
      operationId: storedOperation.name,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    throw error;
  }
}

/**
 * 동영상 다운로드 (파일로 저장)
 */
export async function downloadVideo(
  videoUri: string,
  downloadPath: string,
  correlationId?: string
): Promise<void> {
  try {
    logger.info('Downloading Veo3 video', {
      correlationId,
      videoUri,
      downloadPath,
    });

    await ai.files.download({
      file: videoUri,
      downloadPath,
    });

    logger.info('Veo3 video downloaded successfully', {
      correlationId,
      downloadPath,
    });

  } catch (error) {
    logger.error('Veo3 video download failed', {
      correlationId,
      videoUri,
      error: (error as Error).message,
    });

    throw error;
  }
}

/**
 * API 키 유효성 검증 (Veo3용)
 */
export async function validateVeo3ApiKey(): Promise<boolean> {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('여기에_발급받은')) {
      logger.warn('Veo3 API key not configured');
      return false;
    }

    // 간단한 테스트 요청
    const operation = await ai.models.generateVideos({
      model: 'veo-3.0-generate-001',
      prompt: 'test video',
      config: {
        aspectRatio: '16:9',
        resolution: '720p',
      },
    });

    logger.info('Veo3 API key validation successful');
    return true;
  } catch (error) {
    logger.error('Veo3 API key validation failed', {
      error: (error as Error).message,
    });
    return false;
  }
}
