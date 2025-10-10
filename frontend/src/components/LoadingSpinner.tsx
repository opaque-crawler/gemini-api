import React, { useEffect, useState } from 'react';

interface LoadingSpinnerProps {
  message?: string;
  progress?: number; // 0-100
  estimatedTime?: number; // seconds
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = '처리 중...',
  progress,
  estimatedTime,
  size = 'medium',
  showProgress = true,
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);

  // 경과 시간 카운터
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 크기 설정
  const sizeMap = {
    small: { spinner: 24, text: 14 },
    medium: { spinner: 40, text: 16 },
    large: { spinner: 64, text: 18 },
  };

  const dimensions = sizeMap[size];

  // 시간 포맷팅
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}초`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  // 진행률 계산
  const displayProgress = progress !== undefined ? Math.min(100, Math.max(0, progress)) : undefined;

  return (
    <div
      className="loading-spinner"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* 스피너 */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        {/* 배경 원 */}
        {showProgress && displayProgress !== undefined && (
          <svg
            width={dimensions.spinner}
            height={dimensions.spinner}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              transform: 'rotate(-90deg)',
            }}
          >
            <circle
              cx={dimensions.spinner / 2}
              cy={dimensions.spinner / 2}
              r={(dimensions.spinner - 4) / 2}
              fill="none"
              stroke="#e1e4e8"
              strokeWidth="4"
            />
            <circle
              cx={dimensions.spinner / 2}
              cy={dimensions.spinner / 2}
              r={(dimensions.spinner - 4) / 2}
              fill="none"
              stroke="#1890ff"
              strokeWidth="4"
              strokeDasharray={`${
                (Math.PI * (dimensions.spinner - 4) * displayProgress) / 100
              } ${Math.PI * (dimensions.spinner - 4)}`}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dasharray 0.3s ease',
              }}
            />
          </svg>
        )}

        {/* 회전 스피너 */}
        <div
          className="spinner-rotate"
          style={{
            width: dimensions.spinner,
            height: dimensions.spinner,
            border: `4px solid ${showProgress && displayProgress !== undefined ? 'transparent' : '#f3f3f3'}`,
            borderTop: `4px solid #1890ff`,
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />

        {/* 진행률 텍스트 */}
        {showProgress && displayProgress !== undefined && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: dimensions.text - 2,
              fontWeight: 600,
              color: '#1890ff',
            }}
          >
            {Math.round(displayProgress)}%
          </div>
        )}
      </div>

      {/* 메시지 */}
      <div
        style={{
          fontSize: dimensions.text,
          fontWeight: 500,
          color: '#333',
          marginBottom: '8px',
          textAlign: 'center',
        }}
      >
        {message}
      </div>

      {/* 시간 정보 */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          fontSize: dimensions.text - 2,
          color: '#666',
        }}
      >
        {elapsedTime > 0 && (
          <div>
            ⏱️ 경과: <span style={{ fontWeight: 600 }}>{formatTime(elapsedTime)}</span>
          </div>
        )}
        {estimatedTime !== undefined && estimatedTime > 0 && (
          <div>
            ⏳ 예상: <span style={{ fontWeight: 600 }}>{formatTime(estimatedTime)}</span>
          </div>
        )}
      </div>

      {/* 진행 단계 표시 */}
      {showProgress && displayProgress !== undefined && (
        <div style={{ marginTop: '16px', width: '100%', maxWidth: '300px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '8px',
              fontSize: dimensions.text - 4,
              color: '#666',
            }}
          >
            <span>진행 단계:</span>
            <span style={{ fontWeight: 600 }}>
              {displayProgress < 33
                ? '🔄 이미지 업로드'
                : displayProgress < 66
                ? '🤖 AI 분석 중'
                : displayProgress < 100
                ? '📊 결과 처리'
                : '✅ 완료'}
            </span>
          </div>
          <div
            style={{
              width: '100%',
              height: '6px',
              backgroundColor: '#e1e4e8',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${displayProgress}%`,
                height: '100%',
                backgroundColor: '#1890ff',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {/* 팁 */}
      {elapsedTime > 5 && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f6f8fa',
            borderRadius: '6px',
            fontSize: dimensions.text - 3,
            color: '#666',
            textAlign: 'center',
            maxWidth: '400px',
          }}
        >
          💡 Tip: 대용량 이미지나 복잡한 프롬프트는 처리 시간이 더 걸릴 수 있습니다.
        </div>
      )}

      {/* 스피너 애니메이션 CSS */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingSpinner;
