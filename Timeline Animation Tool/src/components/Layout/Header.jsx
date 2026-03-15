import React, { useState } from 'react';
import { CodeBracketIcon } from '@heroicons/react/24/outline';
import CodeExportDialog from '../CodeExport/CodeExportDialog';

const Header = () => {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-5 h-12 bg-[#1976d2] text-white shadow-md shrink-0" role="banner">
        <h1 className="text-base font-semibold tracking-tight">Timeline Animation Tool</h1>
        <div className="flex items-center gap-4">
          <span className="text-[13px] text-blue-100 hidden sm:inline">Full Featured Animation Editor</span>
          <button
            onClick={() => setExportDialogOpen(true)}
            className="flex items-center gap-2 px-4 py-1.5 text-[13px] font-semibold border border-white/70 rounded hover:bg-white/15 active:bg-white/25 transition-colors"
            aria-label="Export animation code"
          >
            <CodeBracketIcon className="w-[18px] h-[18px]" />
            Export Code
          </button>
        </div>
      </header>
      <CodeExportDialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} />
    </>
  );
};

export default Header;