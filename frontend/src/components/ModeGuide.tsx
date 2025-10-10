import React, { useState } from 'react';
import { Info, Lightbulb, ChevronDown, ChevronUp } from 'lucide-react';
import { GenerationMode } from './TabSelector';
import './ModeGuide.css';

interface ModeGuideProps {
  mode: GenerationMode;
  onExampleClick: (example: string) => void;
}

const modeGuides: Record<
  GenerationMode,
  {
    title: string;
    description: string;
    tips: string[];
    examples: string[];
  }
> = {
  'text-to-image': {
    title: 'Text to Image',
    description: '텍스트 설명만으로 고품질 이미지를 생성합니다.',
    tips: [
      '구체적이고 상세한 설명을 제공하세요',
      '조명, 분위기, 구도 등을 명시하세요',
      '전문적인 사진/예술 용어를 사용하세요',
    ],
    examples: [
      'A serene mountain landscape at sunset, with golden light reflecting off a calm lake, pine trees in the foreground, dramatic clouds, photorealistic style',
      '미래형 도시의 스카이라인, 네온 조명, 비 오는 밤, 사이버펑크 스타일',
      'A cozy coffee shop interior, warm lighting, wooden furniture, plants by the window, morning atmosphere',
    ],
  },
  'image-editing': {
    title: 'Image Editing',
    description: '업로드한 이미지를 수정하거나 변환합니다.',
    tips: [
      '이미지를 먼저 업로드하세요',
      '변경하고 싶은 부분을 명확히 지정하세요',
      '원본의 조명과 시점을 유지합니다',
    ],
    examples: [
      'Change the shirt color to blue',
      '배경을 해변으로 바꿔주세요',
      'Add sunglasses to the person in the image',
      'Remove the object in the background',
      'Make it look like a watercolor painting',
    ],
  },
  'multi-image': {
    title: 'Multi-Image Composition',
    description: '여러 이미지의 요소를 결합하여 새로운 이미지를 만듭니다.',
    tips: [
      '2개 이상의 이미지를 업로드하세요',
      '각 이미지에서 가져올 요소를 명시하세요',
      '합성할 방법을 구체적으로 설명하세요',
    ],
    examples: [
      'Combine the person from image 1 with the background from image 2',
      '첫 번째 이미지의 스타일을 두 번째 이미지에 적용해주세요',
      'Create a collage with elements from all uploaded images',
    ],
  },
  'text-rendering': {
    title: 'Text in Image',
    description: '정확하고 읽기 쉬운 텍스트가 포함된 이미지를 생성합니다.',
    tips: [
      '포함할 텍스트를 명확히 지정하세요',
      '텍스트의 스타일과 위치를 설명하세요',
      '로고, 포스터, 다이어그램에 적합합니다',
    ],
    examples: [
      'Create a modern logo with the text "TechStart" in bold sans-serif font, blue and white colors',
      '"SALE 50% OFF" 텍스트가 큰 글씨로 들어간 쇼핑 배너',
      'A motivational poster with "Dream Big" in elegant typography, minimalist design',
    ],
  },
  iterative: {
    title: 'Iterative Editing',
    description: '대화를 통해 이미지를 점진적으로 수정합니다.',
    tips: [
      '초기 이미지를 생성하거나 업로드하세요',
      '한 번에 하나씩 작은 변경을 요청하세요',
      '이전 결과를 기반으로 계속 개선하세요',
    ],
    examples: [
      'Make it brighter',
      '더 따뜻한 색감으로 바꿔주세요',
      'Add more details to the background',
      'Make the subject larger',
    ],
  },
};

const ModeGuide: React.FC<ModeGuideProps> = ({ mode, onExampleClick }) => {
  const guide = modeGuides[mode];
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mode-guide">
      <div className="guide-header">
        <Info size={20} className="guide-icon" />
        <div className="guide-header-content">
          <h3 className="guide-title">{guide.title}</h3>
          <p className="guide-description">{guide.description}</p>
        </div>
        <button
          className="guide-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? '가이드 접기' : '가이드 펼치기'}
        >
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="guide-content">
          <div className="guide-tips">
            <div className="tips-header">
              <Lightbulb size={16} />
              <span>사용 팁</span>
            </div>
            <ul className="tips-list">
              {guide.tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="guide-examples">
            <div className="examples-header">예시 프롬프트</div>
            <div className="examples-list">
              {guide.examples.map((example, index) => (
                <button
                  key={index}
                  className="example-item"
                  onClick={() => onExampleClick(example)}
                  title="클릭하여 프롬프트에 적용"
                >
                  <span className="example-text">{example}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModeGuide;
