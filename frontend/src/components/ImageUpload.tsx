import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image, Upload as UploadIcon, AlertTriangle, X, Trash2 } from 'lucide-react';
import {
  validateFiles,
  formatFileSize,
  createPreviewUrl,
  revokePreviewUrl,
} from '../services/fileValidator';
import './ImageUpload.css';

interface ImagePreview {
  file: File;
  preview: string;
  id: string;
}

interface ImageUploadProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onFilesSelected,
  maxFiles = 5,
  disabled = false,
}) => {
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // 파일 선택 핸들러
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      // 파일 검증
      const validation = validateFiles(acceptedFiles, { maxFiles });

      if (!validation.valid) {
        setErrors(validation.errors);
        return;
      }

      // 에러 초기화
      setErrors([]);

      // 미리보기 생성
      const newPreviews: ImagePreview[] = acceptedFiles.map((file) => ({
        file,
        preview: createPreviewUrl(file),
        id: Math.random().toString(36).substring(7),
      }));

      setPreviews(newPreviews);
      onFilesSelected(acceptedFiles);
    },
    [maxFiles, onFilesSelected]
  );

  // react-dropzone 설정
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'image/gif': ['.gif'],
    },
    maxFiles,
    maxSize: 100 * 1024 * 1024, // 100MB
    disabled,
  });

  // 개별 이미지 제거
  const removeImage = (id: string) => {
    const updatedPreviews = previews.filter((p) => p.id !== id);
    setPreviews(updatedPreviews);
    onFilesSelected(updatedPreviews.map((p) => p.file));
  };

  // 모든 이미지 제거
  const clearAll = () => {
    setPreviews([]);
    setErrors([]);
    onFilesSelected([]);
  };

  // 컴포넌트 언마운트 시 미리보기 URL 정리
  useEffect(() => {
    return () => {
      previews.forEach((preview) => {
        revokePreviewUrl(preview.preview);
      });
    };
  }, [previews]);

  return (
    <div className="image-upload">
      {/* 드롭존 */}
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${
          isDragReject ? 'reject' : ''
        } ${disabled ? 'disabled' : ''}`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <Image className="dropzone-icon" />
        ) : (
          <UploadIcon className="dropzone-icon" />
        )}

        {isDragActive ? (
          <p className="dropzone-text">이미지를 여기에 놓아주세요...</p>
        ) : isDragReject ? (
          <p className="dropzone-text">지원하지 않는 파일 형식입니다</p>
        ) : (
          <div>
            <p className="dropzone-text">
              이미지를 드래그하거나 클릭하여 업로드
            </p>
            <p className="dropzone-subtext">
              JPEG, PNG, WebP, GIF 지원 (최대 {maxFiles}개, 각 100MB 이하)
            </p>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {errors.length > 0 && (
        <div className="upload-error-messages">
          <div className="upload-error-title">
            <AlertTriangle className="icon" />
            업로드 오류:
          </div>
          <ul className="upload-error-list">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 미리보기 */}
      {previews.length > 0 && (
        <div className="preview-container">
          <div className="preview-header">
            <h3 className="preview-title">
              선택된 이미지 ({previews.length}/{maxFiles})
            </h3>
            <button
              onClick={clearAll}
              className="preview-clear-btn"
              aria-label="모든 이미지 제거"
            >
              <Trash2 size={14} style={{ marginRight: '4px' }} />
              모두 제거
            </button>
          </div>

          <div className="preview-grid">
            {previews.map((preview) => (
              <div key={preview.id} className="preview-item">
                <img
                  src={preview.preview}
                  alt={preview.file.name}
                  className="preview-image"
                />
                <div className="preview-info">
                  <div className="preview-filename" title={preview.file.name}>
                    {preview.file.name}
                  </div>
                  <div className="preview-filesize">
                    {formatFileSize(preview.file.size)}
                  </div>
                </div>
                <button
                  onClick={() => removeImage(preview.id)}
                  className="preview-remove-btn"
                  aria-label={`${preview.file.name} 제거`}
                >
                  <X className="icon" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
