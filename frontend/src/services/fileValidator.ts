// 파일 검증 관련 타입 정의
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface FileValidationOptions {
  maxFileSize?: number; // bytes
  maxTotalSize?: number; // bytes
  maxFiles?: number;
  allowedMimeTypes?: string[];
}

// 기본 설정값
const DEFAULT_OPTIONS: Required<FileValidationOptions> = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxTotalSize: 20 * 1024 * 1024, // 20MB
  maxFiles: 5,
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

/**
 * 파일 MIME 타입 검증
 */
export function validateMimeType(file: File, allowedTypes: string[] = DEFAULT_OPTIONS.allowedMimeTypes): ValidationResult {
  const errors: string[] = [];

  if (!allowedTypes.includes(file.type)) {
    errors.push(
      `${file.name}: 지원하지 않는 파일 형식입니다. (허용: JPEG, PNG, WebP, GIF)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(
  file: File,
  maxSize: number = DEFAULT_OPTIONS.maxFileSize
): ValidationResult {
  const errors: string[] = [];

  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    errors.push(
      `${file.name}: 파일 크기가 너무 큽니다. (${fileSizeMB}MB / 최대 ${maxSizeMB}MB)`
    );
  }

  if (file.size === 0) {
    errors.push(`${file.name}: 빈 파일입니다.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 전체 파일 크기 검증
 */
export function validateTotalSize(
  files: File[],
  maxTotalSize: number = DEFAULT_OPTIONS.maxTotalSize
): ValidationResult {
  const errors: string[] = [];
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);

  if (totalSize > maxTotalSize) {
    const maxSizeMB = (maxTotalSize / (1024 * 1024)).toFixed(1);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(1);
    errors.push(
      `전체 파일 크기가 너무 큽니다. (${totalSizeMB}MB / 최대 ${maxSizeMB}MB)`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 파일 개수 검증
 */
export function validateFileCount(
  files: File[],
  maxFiles: number = DEFAULT_OPTIONS.maxFiles
): ValidationResult {
  const errors: string[] = [];

  if (files.length === 0) {
    errors.push('최소 1개의 이미지를 선택해주세요.');
  }

  if (files.length > maxFiles) {
    errors.push(`최대 ${maxFiles}개의 이미지만 업로드할 수 있습니다. (현재: ${files.length}개)`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 파일명 검증 (특수문자, 길이 등)
 */
export function validateFileName(file: File): ValidationResult {
  const errors: string[] = [];

  // 파일명 길이 제한 (확장자 포함 255자)
  if (file.name.length > 255) {
    errors.push(`${file.name}: 파일명이 너무 깁니다. (최대 255자)`);
  }

  // 위험한 문자 검사 (선택사항)
  // eslint-disable-next-line no-control-regex
  const dangerousChars = /[<>:"|?*\x00-\x1f]/;
  if (dangerousChars.test(file.name)) {
    errors.push(`${file.name}: 파일명에 허용되지 않는 문자가 포함되어 있습니다.`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 종합 파일 검증
 */
export function validateFiles(
  files: File[],
  options: FileValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const allErrors: string[] = [];

  // 1. 파일 개수 검증
  const countResult = validateFileCount(files, opts.maxFiles);
  allErrors.push(...countResult.errors);

  // 개수가 유효하지 않으면 더 이상 검증하지 않음
  if (!countResult.valid) {
    return {
      valid: false,
      errors: allErrors,
    };
  }

  // 2. 전체 크기 검증
  const totalSizeResult = validateTotalSize(files, opts.maxTotalSize);
  allErrors.push(...totalSizeResult.errors);

  // 3. 개별 파일 검증
  files.forEach((file) => {
    // 파일명 검증
    const nameResult = validateFileName(file);
    allErrors.push(...nameResult.errors);

    // MIME 타입 검증
    const mimeResult = validateMimeType(file, opts.allowedMimeTypes);
    allErrors.push(...mimeResult.errors);

    // 파일 크기 검증
    const sizeResult = validateFileSize(file, opts.maxFileSize);
    allErrors.push(...sizeResult.errors);
  });

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}

/**
 * 파일 타입별 확장자 추출
 */
export function getFileExtension(file: File): string {
  const parts = file.name.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

/**
 * 파일 크기를 읽기 좋은 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 이미지 미리보기 URL 생성
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * 이미지 미리보기 URL 해제
 */
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * 이미지 차원(크기) 가져오기
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = createPreviewUrl(file);

    img.onload = () => {
      revokePreviewUrl(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };

    img.onerror = () => {
      revokePreviewUrl(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * 파일이 이미지인지 확인
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * 지원되는 이미지 포맷인지 확인
 */
export function isSupportedImageFormat(file: File): boolean {
  return DEFAULT_OPTIONS.allowedMimeTypes.includes(file.type);
}

export default {
  validateFiles,
  validateMimeType,
  validateFileSize,
  validateTotalSize,
  validateFileCount,
  validateFileName,
  getFileExtension,
  formatFileSize,
  createPreviewUrl,
  revokePreviewUrl,
  getImageDimensions,
  isImageFile,
  isSupportedImageFormat,
};
