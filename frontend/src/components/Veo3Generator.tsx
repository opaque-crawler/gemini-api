import React, { useState } from 'react';
import { Video, Wand2, Settings, Upload, Loader } from 'lucide-react';
import './Veo3Generator.css';

interface Veo3GeneratorProps {
  sessionId: string;
}

interface VideoGenerationResult {
  operationId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}

type VeoModel = 'veo-3.0-generate-001' | 'veo-3.0-fast-generate-001' | 'veo-2.0-generate-001';

const Veo3Generator: React.FC<Veo3GeneratorProps> = ({ sessionId }) => {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [model, setModel] = useState<VeoModel>('veo-3.0-generate-001');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [uploadedImageId, setUploadedImageId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [generationResult, setGenerationResult] = useState<VideoGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 이미지 업로드
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImage(file);
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('images', file);
      formData.append('sessionId', sessionId);

      const response = await fetch('http://localhost:3001/api/v1/images', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      const data = await response.json();
      setUploadedImageId(data.images[0].id);
    } catch (err) {
      setError((err as Error).message);
      setSelectedImage(null);
    } finally {
      setIsUploading(false);
    }
  };

  // 동영상 생성 시작
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('프롬프트를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGenerationResult(null);

    try {
      const requestBody: any = {
        sessionId,
        prompt,
        model,
        aspectRatio,
        resolution,
      };

      if (negativePrompt.trim()) {
        requestBody.negativePrompt = negativePrompt;
      }

      if (uploadedImageId) {
        requestBody.imageId = uploadedImageId;
      }

      const response = await fetch('http://localhost:3001/api/v1/videos/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start video generation');
      }

      const data = await response.json();
      setGenerationResult({
        operationId: data.operationId,
        status: data.status,
      });

      // 상태 폴링 시작
      pollVideoStatus(data.operationId);

    } catch (err) {
      setError((err as Error).message);
      setIsGenerating(false);
    }
  };

  // 동영상 생성 상태 폴링
  const pollVideoStatus = async (operationId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const encodedOperationId = encodeURIComponent(operationId);
        const response = await fetch(`http://localhost:3001/api/v1/videos/status/${encodedOperationId}`);

        if (!response.ok) {
          throw new Error('Failed to check video status');
        }

        const data = await response.json();

        if (data.status === 'completed') {
          setGenerationResult({
            operationId: data.operationId,
            status: 'completed',
            videoUrl: data.videoUrl,
          });
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else if (data.status === 'failed') {
          setGenerationResult({
            operationId: data.operationId,
            status: 'failed',
            error: data.error,
          });
          setError(data.error || 'Video generation failed');
          setIsGenerating(false);
          clearInterval(pollInterval);
        } else {
          setGenerationResult({
            operationId: data.operationId,
            status: data.status,
          });
        }
      } catch (err) {
        setError((err as Error).message);
        setIsGenerating(false);
        clearInterval(pollInterval);
      }
    }, 10000); // 10초마다 폴링

    // 최대 6분 후 폴링 중지
    setTimeout(() => {
      clearInterval(pollInterval);
      if (isGenerating) {
        setError('Generation timeout. Please try again.');
        setIsGenerating(false);
      }
    }, 360000);
  };

  // 새로운 생성 시작
  const handleReset = () => {
    setPrompt('');
    setNegativePrompt('');
    setSelectedImage(null);
    setUploadedImageId(null);
    setGenerationResult(null);
    setError(null);
    setIsGenerating(false);
  };

  return (
    <div className="veo3-generator">
      <div className="veo3-header">
        <Video className="veo3-header-icon" size={32} />
        <div>
          <h2 className="veo3-title">Veo3 동영상 생성</h2>
          <p className="veo3-subtitle">AI로 8초짜리 고화질 동영상을 생성하세요</p>
        </div>
      </div>

      {error && (
        <div className="veo3-error">
          <span>{error}</span>
        </div>
      )}

      <div className="veo3-form">
        {/* 프롬프트 입력 */}
        <div className="veo3-form-group">
          <label className="veo3-label">
            <Wand2 size={18} />
            동영상 설명 (Prompt) *
          </label>
          <textarea
            className="veo3-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="예: A cinematic shot of a majestic lion walking through the savanna at sunset"
            rows={4}
            maxLength={2000}
            disabled={isGenerating}
          />
          <span className="veo3-char-count">{prompt.length} / 2000</span>
        </div>

        {/* Negative Prompt */}
        <div className="veo3-form-group">
          <label className="veo3-label">
            제외할 요소 (Negative Prompt)
          </label>
          <input
            type="text"
            className="veo3-input"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="예: cartoon, low quality, blurry"
            maxLength={500}
            disabled={isGenerating}
          />
        </div>

        {/* 이미지 업로드 (선택사항) */}
        <div className="veo3-form-group">
          <label className="veo3-label">
            <Upload size={18} />
            시작 프레임 이미지 (선택사항)
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleImageSelect}
            disabled={isGenerating || isUploading}
            className="veo3-file-input"
          />
          {selectedImage && (
            <div className="veo3-image-preview">
              <img
                src={URL.createObjectURL(selectedImage)}
                alt="Preview"
                className="veo3-preview-img"
              />
              {isUploading && <span className="veo3-uploading">업로드 중...</span>}
            </div>
          )}
        </div>

        {/* 설정 */}
        <div className="veo3-settings">
          <div className="veo3-settings-header">
            <Settings size={18} />
            <span>설정</span>
          </div>

          <div className="veo3-settings-grid">
            <div className="veo3-setting-item">
              <label className="veo3-setting-label">모델 버전</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as VeoModel)}
                className="veo3-select"
                disabled={isGenerating}
              >
                <option value="veo-3.0-generate-001">Veo 3.0 (고품질)</option>
                <option value="veo-3.0-fast-generate-001">Veo 3.0 Fast (빠른 생성)</option>
                <option value="veo-2.0-generate-001">Veo 2.0 (이전 버전)</option>
              </select>
            </div>

            <div className="veo3-setting-item">
              <label className="veo3-setting-label">화면 비율</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as '16:9' | '9:16')}
                className="veo3-select"
                disabled={isGenerating}
              >
                <option value="16:9">16:9 (가로)</option>
                <option value="9:16">9:16 (세로)</option>
              </select>
            </div>

            <div className="veo3-setting-item">
              <label className="veo3-setting-label">해상도</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value as '720p' | '1080p')}
                className="veo3-select"
                disabled={isGenerating}
              >
                <option value="720p">720p (HD)</option>
                <option value="1080p">1080p (Full HD)</option>
              </select>
            </div>
          </div>
        </div>

        {/* 생성 버튼 */}
        {!generationResult && (
          <button
            className="veo3-generate-btn"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader className="veo3-btn-icon spinning" />
                동영상 생성 중...
              </>
            ) : (
              <>
                <Video className="veo3-btn-icon" />
                동영상 생성 시작
              </>
            )}
          </button>
        )}
      </div>

      {/* 생성 결과 */}
      {generationResult && (
        <div className="veo3-result">
          <div className="veo3-result-header">
            <h3>생성 결과</h3>
            <span className={`veo3-status veo3-status-${generationResult.status}`}>
              {generationResult.status === 'processing' && '처리 중...'}
              {generationResult.status === 'completed' && '완료'}
              {generationResult.status === 'failed' && '실패'}
            </span>
          </div>

          {generationResult.status === 'processing' && (
            <div className="veo3-processing">
              <Loader className="veo3-processing-icon spinning" size={48} />
              <p>동영상을 생성하고 있습니다...</p>
              <p className="veo3-processing-note">최대 6분이 소요될 수 있습니다</p>
            </div>
          )}

          {generationResult.status === 'completed' && generationResult.videoUrl && (
            <div className="veo3-video-container">
              <video
                src={generationResult.videoUrl}
                controls
                autoPlay
                loop
                className="veo3-video"
              />
              <button className="veo3-reset-btn" onClick={handleReset}>
                새로운 동영상 생성
              </button>
            </div>
          )}

          {generationResult.status === 'failed' && (
            <div className="veo3-failed">
              <p>동영상 생성에 실패했습니다.</p>
              <p className="veo3-failed-error">{generationResult.error}</p>
              <button className="veo3-reset-btn" onClick={handleReset}>
                다시 시도
              </button>
            </div>
          )}
        </div>
      )}

      {/* 정보 */}
      <div className="veo3-info">
        <h4>Veo3 정보</h4>
        <ul>
          <li>⏱️ 동영상 길이: 8초</li>
          <li>📺 해상도: 720p 또는 1080p</li>
          <li>🔊 네이티브 오디오 포함</li>
          <li>⏳ 생성 시간: 11초 ~ 6분</li>
          <li>💾 서버 저장: 2일간</li>
        </ul>
      </div>
    </div>
  );
};

export default Veo3Generator;
