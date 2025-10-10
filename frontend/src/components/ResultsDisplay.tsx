import React, { useState } from 'react';
import { Images, Download } from 'lucide-react';
import { AnalysisResponse } from '../services/apiClient';

interface ResultsDisplayProps {
  result: AnalysisResponse | null;
  isLoading?: boolean;
  onExport?: (format: 'json' | 'markdown' | 'txt') => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  result,
  isLoading = false,
  onExport,
}) => {
  const [exportFormat, setExportFormat] = useState<'json' | 'markdown' | 'txt'>('markdown');

  if (isLoading) {
    return (
      <div
        className="results-loading"
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#f6f8fa',
          borderRadius: '8px',
          border: '1px solid #e1e4e8',
        }}
      >
        <div
          className="spinner"
          style={{
            width: '40px',
            height: '40px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #1890ff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <div style={{ fontSize: '16px', color: '#666' }}>
          분석 중입니다... 잠시만 기다려주세요
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div
        className="results-empty"
        style={{
          padding: '60px 20px',
          textAlign: 'center',
          backgroundColor: '#fafafa',
          borderRadius: '8px',
          border: '2px dashed #d9d9d9',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
        <div style={{ fontSize: '16px', color: '#666', marginBottom: '8px' }}>
          아직 분석 결과가 없습니다
        </div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          이미지를 업로드하고 프롬프트를 입력하여 분석을 시작하세요
        </div>
      </div>
    );
  }

  const handleExport = () => {
    if (onExport) {
      onExport(exportFormat);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#52c41a';
      case 'partial':
        return '#faad14';
      case 'failed':
        return '#ff4d4f';
      default:
        return '#999';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '✓ 완료';
      case 'partial':
        return '⚠ 부분 완료';
      case 'failed':
        return '✗ 실패';
      default:
        return status;
    }
  };

  return (
    <div className="results-display">
      {/* 헤더 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          paddingBottom: '16px',
          borderBottom: '2px solid #e8e8e8',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
            분석 결과
          </h2>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: getStatusColor(result.status),
            }}
          >
            {getStatusText(result.status)}
          </span>
        </div>

        {/* 내보내기 버튼 */}
        {onExport && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as any)}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                backgroundColor: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
              <option value="txt">Text</option>
            </select>
            <button
              onClick={handleExport}
              style={{
                padding: '6px 16px',
                fontSize: '14px',
                color: '#fff',
                backgroundColor: '#1890ff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>📥</span>
              <span>내보내기</span>
            </button>
          </div>
        )}
      </div>

      {/* 메타데이터 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: '#f6f8fa',
          borderRadius: '6px',
        }}
      >
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            요청 ID
          </div>
          <div
            style={{
              fontSize: '13px',
              fontFamily: 'monospace',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={result.requestId}
          >
            {result.requestId.substring(0, 8)}...
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
            포맷
          </div>
          <div style={{ fontSize: '13px', fontWeight: 500 }}>
            {result.format === 'markdown' ? '📝 Markdown' : '📄 Plain Text'}
          </div>
        </div>
      </div>

      {/* 분석 결과 내용 */}
      <div
        className="result-content"
        style={{
          padding: '20px',
          backgroundColor: '#fff',
          border: '1px solid #e1e4e8',
          borderRadius: '8px',
          fontSize: '15px',
          lineHeight: '1.8',
          color: '#24292e',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '600px',
          overflowY: 'auto',
        }}
      >
        {result.format === 'markdown' ? (
          // Markdown을 간단하게 렌더링 (실제로는 markdown parser 사용 권장)
          <div
            dangerouslySetInnerHTML={{
              __html: result.content
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/`(.+?)`/g, '<code>$1</code>'),
            }}
          />
        ) : (
          <div>{result.content}</div>
        )}
      </div>

      {/* 생성된 이미지 */}
      {result.generatedImages && result.generatedImages.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '2px solid #e8e8e8',
            }}
          >
            <Images size={20} style={{ color: '#2563eb' }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#24292e' }}>
              생성된 이미지 ({result.generatedImages.length})
            </h3>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {result.generatedImages.map((image, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid #e1e4e8',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                onClick={() => {
                  // 새 탭에서 이미지 열기
                  const newWindow = window.open();
                  if (newWindow) {
                    newWindow.document.write(`
                      <html>
                        <head><title>Generated Image ${index + 1}</title></head>
                        <body style="margin:0;display:flex;align-items:center;justify-content:center;background:#000;">
                          <img src="data:${image.mimeType};base64,${image.data}" style="max-width:100%;max-height:100vh;" />
                        </body>
                      </html>
                    `);
                  }
                }}
              >
                <img
                  src={`data:${image.mimeType};base64,${image.data}`}
                  alt={`Generated image ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '280px',
                    objectFit: 'cover',
                    backgroundColor: '#f6f8fa',
                  }}
                />
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#f6f8fa',
                    borderTop: '1px solid #e1e4e8',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#24292e' }}>
                      이미지 {index + 1}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      클릭하여 전체 보기
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 이미지 다운로드
                      const link = document.createElement('a');
                      link.href = `data:${image.mimeType};base64,${image.data}`;
                      link.download = `generated-image-${index + 1}.${image.mimeType.split('/')[1] || 'png'}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 12px',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#2563eb',
                      backgroundColor: '#fff',
                      border: '1px solid #2563eb',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff';
                      e.currentTarget.style.color = '#2563eb';
                    }}
                  >
                    <Download size={16} />
                    <span>다운로드</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 푸터 정보 */}
      <div
        style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#f6ffed',
          border: '1px solid #b7eb8f',
          borderRadius: '4px',
          fontSize: '13px',
          color: '#52c41a',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>
          💡 분석이 완료되었습니다
        </div>
        <div>
          이 결과를 다양한 형식으로 내보낼 수 있습니다. 필요한 형식을 선택하고
          내보내기 버튼을 클릭하세요.
        </div>
      </div>

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

export default ResultsDisplay;
