import React, { useState } from 'react';
import ImageUpload from './components/ImageUpload';
import PromptInput from './components/PromptInput';
import ResultsDisplay from './components/ResultsDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import TabSelector, { GenerationMode } from './components/TabSelector';
import ModeGuide from './components/ModeGuide';
import { useAnalysis } from './hooks/useAnalysis';
import { Sparkles, Upload, Search, RefreshCw, Key, AlertTriangle, X, Check } from 'lucide-react';
import './App.css';

function App() {
  const [activeMode, setActiveMode] = useState<GenerationMode>('text-to-image');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');

  const {
    sessionId,
    uploadedImages,
    analysisResult,
    isUploading,
    isAnalyzing,
    error,
    progress,
    uploadImages,
    analyzeImages,
    exportResult,
    clearError,
    reset,
  } = useAnalysis();

  // 파일 선택 핸들러
  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
  };

  // 업로드 핸들러
  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      return;
    }
    await uploadImages(selectedFiles);
  };

  // 분석 핸들러
  const handleAnalyze = async () => {
    if (prompt.trim().length === 0) {
      return;
    }
    await analyzeImages(prompt);
  };

  // 새로운 분석 시작
  const handleNewAnalysis = () => {
    reset();
    setSelectedFiles([]);
    setPrompt('');
  };

  // 모드 변경 핸들러
  const handleModeChange = (mode: GenerationMode) => {
    setActiveMode(mode);
    // 모드 변경 시 상태 초기화
    setSelectedFiles([]);
    setPrompt('');
    reset();
  };

  // 예시 프롬프트 클릭 핸들러
  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  // 각 모드별 이미지 업로드 필수 여부
  const requiresImages = activeMode !== 'text-to-image' && activeMode !== 'text-rendering';
  const supportsMultipleImages = activeMode === 'multi-image';

  const canUpload = selectedFiles.length > 0 && !isUploading && !uploadedImages;
  const canAnalyze = prompt.trim().length > 0 && !isAnalyzing &&
    (activeMode === 'text-to-image' || activeMode === 'text-rendering' || uploadedImages);

  return (
    <div className="App">
      {/* 헤더 */}
      <header className="app-header">
        <div className="container">
          <h1 className="app-title">
            <Sparkles className="icon" />
            Nano - AI 이미지 분석기
          </h1>
          <p className="app-subtitle">
            Google Gemini AI를 활용한 다중 이미지 분석 서비스
          </p>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="app-main">
        <div className="container">
          {/* 탭 선택 */}
          <TabSelector activeTab={activeMode} onTabChange={handleModeChange} />

          {/* 모드 가이드 */}
          <ModeGuide mode={activeMode} onExampleClick={handleExampleClick} />

          {/* 세션 정보 */}
          {sessionId && (
            <div className="session-info">
              <Key className="icon" />
              <span>세션 ID: {sessionId.substring(0, 8)}...</span>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="error-banner">
              <div className="error-content">
                <AlertTriangle className="error-icon" />
                <span className="error-message">{error}</span>
                <button
                  className="error-close"
                  onClick={clearError}
                  aria-label="에러 메시지 닫기"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step 1: 이미지 업로드 (일부 모드에서만 필요) */}
          {activeMode !== 'text-to-image' && activeMode !== 'text-rendering' && (
            <section className="step-section">
              <div className="step-header">
                <h2 className="step-title">
                  <span className="step-number">1</span>
                  이미지 업로드
                  {requiresImages && (
                    <span className="required-badge">필수</span>
                  )}
                </h2>
                {uploadedImages && (
                  <span className="step-badge success">
                    <Check className="icon" />
                    {uploadedImages.images.length}개 업로드됨
                  </span>
                )}
              </div>

              <ImageUpload
                onFilesSelected={handleFilesSelected}
                maxFiles={supportsMultipleImages ? 5 : 1}
                disabled={isUploading || !!uploadedImages}
              />

              {selectedFiles.length > 0 && !uploadedImages && (
                <button
                  className="btn btn-primary btn-upload"
                  onClick={handleUpload}
                  disabled={!canUpload}
                >
                  {isUploading ? (
                    <>
                      <span className="spinner-small" />
                      업로드 중... ({progress}%)
                    </>
                  ) : (
                    <>
                      <Upload className="icon" />
                      {selectedFiles.length}개 이미지 업로드
                    </>
                  )}
                </button>
              )}
            </section>
          )}

          {/* Step 2: 프롬프트 입력 */}
          <section className="step-section">
            <div className="step-header">
              <h2 className="step-title">
                <span className="step-number">{activeMode === 'text-to-image' || activeMode === 'text-rendering' ? '1' : '2'}</span>
                프롬프트 입력
              </h2>
              {uploadedImages && (
                <span className="step-badge success">
                  <Check className="icon" />
                  {uploadedImages.images.length}개 이미지 포함
                </span>
              )}
            </div>

            <PromptInput
              value={prompt}
              onChange={setPrompt}
              onSubmit={handleAnalyze}
              disabled={isAnalyzing || !!analysisResult}
            />

            {!analysisResult && (
              <button
                className="btn btn-primary btn-analyze"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
              >
                {isAnalyzing ? (
                  <>
                    <span className="spinner-small" />
                    분석 중...
                  </>
                ) : (
                  <>
                    <Search className="icon" />
                    {uploadedImages ? '이미지 분석 시작' : 'AI에게 질문하기'}
                  </>
                )}
              </button>
            )}
          </section>

          {/* Step 3: 로딩 상태 */}
          {isAnalyzing && (
            <section className="step-section">
              <LoadingSpinner
                message="AI가 이미지를 분석하고 있습니다..."
                progress={progress}
                size="medium"
                showProgress={true}
              />
            </section>
          )}

          {/* Step 3: 결과 표시 */}
          {analysisResult && (
            <section className="step-section">
              <div className="step-header">
                <h2 className="step-title">
                  <span className="step-number">{activeMode === 'text-to-image' || activeMode === 'text-rendering' ? '2' : '3'}</span>
                  {activeMode === 'iterative' ? '생성 결과 (계속 수정 가능)' : '생성 결과'}
                </h2>
                <button className="btn btn-secondary" onClick={handleNewAnalysis}>
                  <RefreshCw className="icon" />
                  새로운 분석 시작
                </button>
              </div>

              <ResultsDisplay
                result={analysisResult}
                isLoading={isAnalyzing}
                onExport={exportResult}
              />
            </section>
          )}
        </div>
      </main>

      {/* 푸터 */}
      <footer className="app-footer">
        <div className="container">
          <p>
            Powered by{' '}
            <a
              href="https://ai.google.dev/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Gemini AI
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
