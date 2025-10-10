import { GoogleGenAI } from '@google/genai';
import { createLogger } from '../utils/logger';

const logger = createLogger('gemini');

// API 키 로드 확인
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  logger.error('GEMINI_API_KEY not found in environment variables');
} else {
  logger.info('GEMINI_API_KEY loaded successfully', {
    keyPrefix: apiKey.substring(0, 20) + '...',
    keyLength: apiKey.length
  });
}

// Gemini API 클라이언트 초기화
const ai = new GoogleGenAI({
  apiKey: apiKey || '',
});

export interface ImageData {
  id: string;
  mimeType: string;
  buffer: Buffer;
  originalName: string;
}

export interface AnalysisOptions {
  prompt: string;
  images: ImageData[];
  correlationId?: string;
}

export interface GeneratedImage {
  mimeType: string;
  data: string; // base64 encoded
}

export interface AnalysisResult {
  content: string;
  format: 'markdown' | 'plaintext';
  tokensUsed?: number;
  generatedImages?: GeneratedImage[];
}

/**
 * Google Gemini API를 사용하여 텍스트 또는 이미지 분석
 */
export async function analyzeImages(options: AnalysisOptions): Promise<AnalysisResult> {
  const { prompt, images, correlationId } = options;

  try {
    logger.info('Starting Gemini API analysis', {
      correlationId,
      imageCount: images.length,
      promptLength: prompt.length,
    });

    // 프롬프트 구성
    let contents: any;

    if (images.length > 0) {
      // 이미지가 있는 경우: parts 배열로 구성
      const parts = [
        { text: prompt },
        ...images.map((img) => ({
          inlineData: {
            mimeType: img.mimeType,
            data: img.buffer.toString('base64'),
          },
        })),
      ];
      contents = { parts };
    } else {
      // 텍스트만 있는 경우
      contents = prompt;
    }

    logger.debug('Sending request to Gemini API', {
      correlationId,
      model: 'gemini-2.5-flash-image',
      hasImages: images.length > 0,
    });

    // API 호출
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents,
    });

    const text = response.text || '';

    // 생성된 이미지 추출
    const generatedImages: GeneratedImage[] = [];
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          generatedImages.push({
            mimeType: part.inlineData.mimeType || 'image/png',
            data: part.inlineData.data,
          });
        }
      }
    }

    logger.info('Gemini API analysis completed', {
      correlationId,
      responseLength: text.length,
      tokensUsed: response.usageMetadata?.totalTokenCount,
      generatedImagesCount: generatedImages.length,
    });

    const result: AnalysisResult = {
      content: text,
      format: 'markdown',
    };

    if (response.usageMetadata?.totalTokenCount) {
      result.tokensUsed = response.usageMetadata.totalTokenCount;
    }

    if (generatedImages.length > 0) {
      result.generatedImages = generatedImages;
    }

    return result;

  } catch (error) {
    logger.error('Gemini API analysis failed', {
      correlationId,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });

    // 에러를 다시 던져서 상위에서 처리하도록 함
    throw error;
  }
}

/**
 * API 키 유효성 검증
 */
export async function validateApiKey(): Promise<boolean> {
  try {
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes('여기에_발급받은')) {
      logger.warn('Gemini API key not configured');
      return false;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: 'test',
    });

    logger.info('Gemini API key validation successful');
    return true;
  } catch (error) {
    logger.error('Gemini API key validation failed', {
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * 사용 가능한 모델 목록 조회
 */
export async function listModels(): Promise<string[]> {
  try {
    // 현재 사용 가능한 모델들
    const models = [
      'gemini-2.5-flash-image',
    ];

    logger.info('Available Gemini models listed', {
      models,
    });

    return models;
  } catch (error) {
    logger.error('Failed to list Gemini models', {
      error: (error as Error).message,
    });
    return [];
  }
}
