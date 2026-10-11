import React from 'react';
import { Download } from 'lucide-react';

export type ActiveTab = 'studio' | 'analytics' | 'tripwires' | 'ai' | 'docs';

interface HeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onExport,
}) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-8 border-b border-slate-800 bg-slate-950/90 px-6 py-3.5 backdrop-blur-md">
      {/* Zone 1: Single text element Brand wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('studio');
          }}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap transition-colors hover:text-indigo-400"
        >
          VisionTrack AI
        </a>
        <span className="hidden text-xs text-slate-500 sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="hidden text-xs text-slate-400 sm:inline">
          Computer Vision Studio
        </span>
      </div>

      {/* Zone 2: 4–5 clean single-line nav links with hover underlines */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
        <button
          onClick={() => setActiveTab('studio')}
          className={`cursor-pointer whitespace-nowrap pb-1 transition-colors ${
            activeTab === 'studio'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Live Studio
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`cursor-pointer whitespace-nowrap pb-1 transition-colors ${
            activeTab === 'analytics'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Analytics & Heatmap
        </button>
        <button
          onClick={() => setActiveTab('tripwires')}
          className={`cursor-pointer whitespace-nowrap pb-1 transition-colors ${
            activeTab === 'tripwires'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Tripwires & ROI
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`cursor-pointer whitespace-nowrap pb-1 transition-colors ${
            activeTab === 'ai'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          AI Scene Audit
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`cursor-pointer whitespace-nowrap pb-1 transition-colors ${
            activeTab === 'docs'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Docs & Tests
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 cursor-pointer whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Analytics</span>
        </button>
      </div>
    </header>
  );
};
