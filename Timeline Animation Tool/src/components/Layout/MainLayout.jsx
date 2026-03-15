import React, { useState } from 'react';
import Header from './Header';
import Toolbar from '../Toolbar/Toolbar';
import Canvas from '../Canvas/Canvas';
import Timeline from '../Timeline/Timeline';
import PropertiesPanel from '../PropertiesPanel/PropertiesPanel';
import LivePreview from '../CodeExport/LivePreview';

const MainLayout = () => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <Toolbar />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[#f5f5f5]">
          {/* Tab Navigation — matches MUI Tabs appearance */}
          <div className="bg-white border-b border-gray-300 px-4 shrink-0" role="tablist" aria-label="View tabs">
            <div className="flex">
              {['Editor', 'Live Preview'].map((label, idx) => (
                <button
                  key={label}
                  role="tab"
                  aria-selected={activeTab === idx}
                  aria-controls={`tabpanel-${idx}`}
                  id={`tab-${idx}`}
                  onClick={() => setActiveTab(idx)}
                  className={`
                    relative px-5 py-3 text-[14px] font-medium tracking-wide transition-colors
                    border-b-2 min-w-[100px]
                    ${activeTab === idx 
                      ? 'text-[#1976d2] border-[#1976d2]' 
                      : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'}
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Panels */}
          <div className="flex-1 overflow-auto p-3">
            <div
              role="tabpanel"
              id="tabpanel-0"
              aria-labelledby="tab-0"
              className={activeTab === 0 ? 'flex flex-col h-full' : 'hidden'}
            >
              <Canvas />
              <Timeline />
            </div>
            
            <div
              role="tabpanel"
              id="tabpanel-1"
              aria-labelledby="tab-1"
              className={activeTab === 1 ? 'h-full overflow-auto' : 'hidden'}
            >
              <LivePreview />
            </div>
          </div>
        </main>
        
        {/* Right Properties Panel */}
        <PropertiesPanel />
      </div>
    </div>
  );
};

export default MainLayout;