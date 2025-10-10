import React, { useState, useCallback, ChangeEvent } from 'react';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
}

const PromptInput: React.FC<PromptInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  maxLength = 2000,
  placeholder = '이미지에 대해 무엇을 분석하고 싶으신가요? (예: 이 이미지들의 공통점과 차이점을 분석해주세요)',
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      // 최대 길이 제한
      if (newValue.length <= maxLength) {
        onChange(newValue);
      }
    },
    [maxLength, onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd + Enter로 제출
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit]
  );

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.9; // 90% 이상
  const isAtLimit = characterCount >= maxLength;
  const isEmpty = value.trim().length === 0;

  return (
    <div className="prompt-input-container" style={{ width: '100%' }}>
      <div
        style={{
          position: 'relative',
          border: `2px solid ${
            isFocused ? '#1890ff' : isAtLimit ? '#ff4d4f' : '#d9d9d9'
          }`,
          borderRadius: '8px',
          transition: 'border-color 0.3s ease',
          backgroundColor: disabled ? '#f5f5f5' : '#fff',
        }}
      >
        <textarea
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={placeholder}
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '15px',
            lineHeight: '1.6',
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            minHeight: '100px',
            maxHeight: '300px',
            fontFamily: 'inherit',
            backgroundColor: 'transparent',
            color: disabled ? '#999' : '#000',
            cursor: disabled ? 'not-allowed' : 'text',
          }}
        />

        {/* 문자 수 카운터 */}
        <div
          style={{
            position: 'absolute',
            bottom: '8px',
            right: '12px',
            fontSize: '12px',
            color: isAtLimit ? '#ff4d4f' : isNearLimit ? '#faad14' : '#999',
            fontWeight: isNearLimit ? 600 : 400,
            pointerEvents: 'none',
          }}
        >
          {characterCount} / {maxLength}
        </div>
      </div>

      {/* 도움말 텍스트 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
          fontSize: '13px',
          color: '#666',
        }}
      >
        <div>
          {isEmpty ? (
            <span style={{ color: '#ff4d4f' }}>✱ 프롬프트를 입력해주세요</span>
          ) : (
            <span>💡 Tip: Ctrl/Cmd + Enter로 빠른 제출</span>
          )}
        </div>

        {isNearLimit && (
          <div
            style={{
              color: isAtLimit ? '#ff4d4f' : '#faad14',
              fontWeight: 600,
            }}
          >
            {isAtLimit ? '⚠️ 최대 길이 도달' : '⚠️ 최대 길이에 근접'}
          </div>
        )}
      </div>

      {/* 추천 프롬프트 예시 */}
      {isEmpty && !isFocused && (
        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#f6f8fa',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#333' }}>
            📝 프롬프트 예시:
          </div>
          <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
            <li>이 이미지들의 공통점과 차이점을 분석해주세요</li>
            <li>각 이미지의 주요 객체와 색상을 설명해주세요</li>
            <li>이 이미지들을 시간 순서대로 정렬하고 설명해주세요</li>
            <li>이미지에서 텍스트를 추출하고 번역해주세요</li>
          </ul>
        </div>
      )}

      {/* 검증 상태 표시 */}
      {!isEmpty && (
        <div
          style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#52c41a',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>✓</span>
          <span>프롬프트가 유효합니다 ({value.trim().split(/\s+/).length}개 단어)</span>
        </div>
      )}
    </div>
  );
};

export default PromptInput;
