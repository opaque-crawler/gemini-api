import { GoogleGenAI } from '@google/genai';
import { createLogger } from '../utils/logger';
import sharp from 'sharp';

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
  httpOptions: {
    timeout: 300000, // 5분 타임아웃 (복잡한 이미지 편집 요청 대응)
  },
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
 * 이미지 리사이징 - Gemini API 타임아웃 방지
 * 최대 1920x1080으로 리사이징하고 JPEG 품질 85%로 압축
 */
async function resizeImageForGemini(buffer: Buffer, mimeType: string): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();

    // 이미 작은 이미지는 그대로 반환 (1MB 이하)
    if (buffer.length < 1024 * 1024) {
      return buffer;
    }

    logger.debug('Resizing image for Gemini API', {
      originalSize: buffer.length,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
    });

    // 최대 크기: 1920x1080
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1080;

    let resized = image.resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    // JPEG로 변환 (품질 85%)
    if (mimeType === 'image/png' || mimeType === 'image/webp') {
      resized = resized.jpeg({ quality: 85 });
    }

    const resizedBuffer = await resized.toBuffer();

    logger.debug('Image resized successfully', {
      originalSize: buffer.length,
      resizedSize: resizedBuffer.length,
      compression: Math.round((1 - resizedBuffer.length / buffer.length) * 100) + '%',
    });

    return resizedBuffer;
  } catch (error) {
    logger.warn('Failed to resize image, using original', {
      error: (error as Error).message,
    });
    return buffer;
  }
}

/**
 * 멀티턴 대화를 사용하여 복잡한 이미지 분석/편집 처리
 * 단계적으로 요청을 나눠서 타임아웃 회피
 */
async function analyzeImagesMultiTurn(options: AnalysisOptions): Promise<AnalysisResult> {
  const { prompt, images, correlationId } = options;

  // 이미지가 최소 1개 이상인지 확인
  if (images.length === 0) {
    throw new Error('At least one image is required for multi-turn conversation');
  }

  logger.info('Starting multi-turn conversation', {
    correlationId,
    imageCount: images.length,
  });

  // 이미지 리사이징 (타임아웃 방지)
  const resizedImages = await Promise.all(
    images.map(async (img) => ({
      ...img,
      buffer: await resizeImageForGemini(img.buffer, img.mimeType),
    }))
  );

  // 1단계: 첫 번째 이미지 분석 (참고 이미지)
  const firstImage = resizedImages[0];
  if (!firstImage) {
    throw new Error('First image is undefined');
  }

  const chat = ai.chats.create({
    model: 'gemini-2.5-flash-image',
  });

  logger.debug('Step 1: Analyzing reference image', { correlationId });

  const step1Message: any[] = [
    { text: '이 이미지의 구조, 스타일, 조명, 구도를 자세히 분석해주세요.' },
    {
      inlineData: {
        mimeType: firstImage.mimeType,
        data: firstImage.buffer.toString('base64'),
      },
    },
  ];

  const step1Response = await chat.sendMessage({
    message: step1Message,
  });

  logger.debug('Step 1 completed', {
    correlationId,
    responseLength: step1Response.text?.length || 0,
  });

  // 2단계: 나머지 이미지와 함께 전체 프롬프트 전달
  const remainingImages = resizedImages.slice(1);

  logger.debug('Step 2: Applying transformation', {
    correlationId,
    remainingImageCount: remainingImages.length,
  });

  const step2Message: any[] = [{ text: prompt }];

  // 나머지 이미지 추가
  for (const img of remainingImages) {
    step2Message.push({
      inlineData: {
        mimeType: img.mimeType,
        data: img.buffer.toString('base64'),
      },
    });
  }

  const step2Response = await chat.sendMessage({ message: step2Message });

  logger.info('Multi-turn conversation completed', {
    correlationId,
    step1Length: step1Response.text?.length || 0,
    step2Length: step2Response.text?.length || 0,
  });

  const text = step2Response.text || '';

  // 생성된 이미지 추출
  const generatedImages: GeneratedImage[] = [];
  if (step2Response.candidates && step2Response.candidates[0]?.content?.parts) {
    for (const part of step2Response.candidates[0].content.parts) {
      if (part.inlineData && part.inlineData.data) {
        generatedImages.push({
          mimeType: part.inlineData.mimeType || 'image/png',
          data: part.inlineData.data,
        });
      }
    }
  }

  const result: AnalysisResult = {
    content: text,
    format: 'markdown',
  };

  if (step2Response.usageMetadata?.totalTokenCount) {
    result.tokensUsed = step2Response.usageMetadata.totalTokenCount;
  }

  if (generatedImages.length > 0) {
    result.generatedImages = generatedImages;
  }

  return result;
}

/**
 * Google Gemini API를 사용하여 텍스트 또는 이미지 분석
 * 복잡한 요청은 자동으로 멀티턴 대화로 분할 처리
 */
export async function analyzeImages(options: AnalysisOptions): Promise<AnalysisResult> {
  const { prompt, images, correlationId } = options;

  try {
    logger.info('Starting Gemini API analysis', {
      correlationId,
      imageCount: images.length,
      promptLength: prompt.length,
    });

    // 복잡한 요청 감지: 이미지 3개 이상 + 매우 긴 프롬프트 (1000자 이상)
    // 너무 공격적으로 멀티턴을 사용하면 타임아웃 발생
    const isComplexRequest = images.length >= 3 && prompt.length >= 1000;

    if (isComplexRequest) {
      logger.info('Complex request detected, using multi-turn conversation', {
        correlationId,
        imageCount: images.length,
        promptLength: prompt.length,
      });

      // 멀티턴 대화로 처리
      return await analyzeImagesMultiTurn(options);
    }

    // 단순 요청: 기존 방식 사용
    // 이미지 리사이징 (타임아웃 방지)
    const resizedImages = await Promise.all(
      images.map(async (img) => ({
        ...img,
        buffer: await resizeImageForGemini(img.buffer, img.mimeType),
      }))
    );

    // 프롬프트 구성
    let contents: any;

    if (resizedImages.length > 0) {
      // 이미지가 있는 경우: parts 배열로 구성
      const parts = [
        { text: prompt },
        ...resizedImages.map((img) => ({
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
