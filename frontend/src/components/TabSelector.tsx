import React from 'react';
import { Wand2, ImagePlus, Layers, Type, MessageSquare } from 'lucide-react';
import './TabSelector.css';

export type GenerationMode =
  | 'text-to-image'
  | 'image-editing'
  | 'multi-image'
  | 'text-rendering'
  | 'iterative';

interface Tab {
  id: GenerationMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface TabSelectorProps {
  activeTab: GenerationMode;
  onTabChange: (tab: GenerationMode) => void;
}

const tabs: Tab[] = [
  {
    id: 'text-to-image',
    label: 'Text to Image',
    icon: <Wand2 size={20} />,
    description: '텍스트 설명으로 이미지 생성',
  },
  {
    id: 'image-editing',
    label: 'Image Editing',
    icon: <ImagePlus size={20} />,
    description: '이미지 수정 및 변환',
  },
  {
    id: 'multi-image',
    label: 'Multi-Image',
    icon: <Layers size={20} />,
    description: '여러 이미지 합성',
  },
  {
    id: 'text-rendering',
    label: 'Text in Image',
    icon: <Type size={20} />,
    description: '텍스트가 포함된 이미지',
  },
  {
    id: 'iterative',
    label: 'Iterative Edit',
    icon: <MessageSquare size={20} />,
    description: '대화형 점진적 편집',
  },
];

const TabSelector: React.FC<TabSelectorProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="tab-selector">
      <div className="tab-header">
        <h2 className="tab-title">이미지 생성 모드</h2>
        <p className="tab-subtitle">원하는 생성 방식을 선택하세요</p>
      </div>

      <div className="tab-list">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="tab-icon">{tab.icon}</div>
            <div className="tab-content">
              <div className="tab-label">{tab.label}</div>
              <div className="tab-description">{tab.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TabSelector;
