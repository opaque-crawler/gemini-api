import React from 'react';
import { Sparkles, Video } from 'lucide-react';
import './MainTabSelector.css';

export type MainTab = 'nano-banana' | 'veo3';

interface MainTabSelectorProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

const mainTabs = [
  {
    id: 'nano-banana' as MainTab,
    label: '🍌 Nano Banana',
    icon: <Sparkles size={24} />,
    description: 'AI 이미지 생성 & 분석',
  },
  {
    id: 'veo3' as MainTab,
    label: '🎬 Veo3',
    icon: <Video size={24} />,
    description: 'AI 동영상 생성',
  },
];

const MainTabSelector: React.FC<MainTabSelectorProps> = ({ activeTab, onTabChange }) => {
  return (
    <div className="main-tab-selector">
      <div className="main-tab-list">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            className={`main-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="main-tab-icon">{tab.icon}</div>
            <div className="main-tab-content">
              <div className="main-tab-label">{tab.label}</div>
              <div className="main-tab-description">{tab.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default MainTabSelector;
