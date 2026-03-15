import React, { useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { XMarkIcon, ClipboardDocumentIcon, ArrowDownTrayIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import Toast from '../ui/Toast';
import { generateAnimationCode, downloadAllFiles, copyToClipboard } from '../../utils/codeGenerator';
import { useCanvasObjects, useKeyframes, useDuration, useLoopPlayback, useFabricCanvas, useCanvasBgColor } from '../../store/hooks';

const CodeExportDialog = ({ open, onClose }) => {
  const [canvasObjects] = useCanvasObjects();
  const [keyframes] = useKeyframes();
  const [duration] = useDuration();
  const [loopPlayback] = useLoopPlayback();
  const [fabricCanvas] = useFabricCanvas();
  const [canvasBgColor] = useCanvasBgColor();
  const [currentTab, setCurrentTab] = useState(0);
  const [snackMessage, setSnackMessage] = useState('');

  const { html, css, javascript } = generateAnimationCode(canvasObjects, keyframes, duration, loopPlayback, fabricCanvas, canvasBgColor);
  const tabs = [{ label: 'HTML', content: html }, { label: 'CSS', content: css }, { label: 'JavaScript', content: javascript }];

  const handleCopy = async (content, label) => { if (await copyToClipboard(content)) setSnackMessage(`${label} copied!`); };
  const handleDownload = () => { downloadAllFiles(html, css, javascript); setSnackMessage('All files downloaded!'); };

  return (
    <>
      <Dialog open={open} onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="w-full max-w-4xl bg-white rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-300">
              <div className="flex items-center gap-2.5">
                <CodeBracketIcon className="w-6 h-6 text-gray-700" />
                <DialogTitle className="text-[18px] font-semibold text-gray-900">Export Animation Code</DialogTitle>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 transition-colors" aria-label="Close dialog">
                <XMarkIcon className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-auto px-6 py-5">
              {/* Tabs — clear separation */}
              <div className="flex border-b border-gray-300 mb-5" role="tablist">
                {tabs.map((tab, idx) => (
                  <button key={tab.label} role="tab" aria-selected={currentTab === idx}
                    onClick={() => setCurrentTab(idx)}
                    className={`px-5 py-3 text-[14px] font-medium border-b-2 transition-colors min-w-[80px]
                      ${currentTab === idx ? 'text-[#1976d2] border-[#1976d2]' : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Code panel */}
              <div className="relative" role="tabpanel">
                <button onClick={() => handleCopy(tabs[currentTab].content, tabs[currentTab].label)}
                  className="absolute top-3 right-3 z-10 p-2 bg-white/95 rounded-lg hover:bg-gray-100 border border-gray-300 shadow-sm transition-colors"
                  aria-label={`Copy ${tabs[currentTab].label}`}>
                  <ClipboardDocumentIcon className="w-5 h-5 text-gray-600" />
                </button>
                <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-5 rounded-lg overflow-auto max-h-[420px] text-[14px] leading-relaxed font-mono">
                  <code>{tabs[currentTab].content}</code>
                </pre>
              </div>

              {/* Instructions */}
              <div className="mt-5 p-4 bg-[#e3f2fd] border border-[#90caf9] rounded-lg text-[14px] text-[#1565c0] leading-relaxed">
                <strong>💡 Usage Instructions:</strong><br/>
                1. Download all files or copy each code block<br/>
                2. Create three files: index.html, style.css, and animation.js<br/>
                3. Place all files in the same folder<br/>
                4. Open index.html in a browser to view your animation<br/>
                5. The animation uses GSAP (loaded from CDN) — no installation required!<br/>
                <br/>
                {loopPlayback
                  ? <strong>🔁 Loop is ENABLED</strong>
                  : <strong>▶️ Loop is DISABLED</strong>}
                {loopPlayback ? ' — Animation will repeat infinitely' : ' — Animation will play once and stop'}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-300">
              <button onClick={onClose} className="px-5 py-2.5 text-[14px] font-medium text-gray-700 hover:bg-gray-100 rounded-md transition-colors">
                Close
              </button>
              <button onClick={handleDownload}
                className="flex items-center gap-2 px-5 py-2.5 text-[14px] font-semibold text-white bg-[#1976d2] rounded-md hover:bg-[#1565c0] shadow-sm transition-colors">
                <ArrowDownTrayIcon className="w-5 h-5" />
                Download All Files
              </button>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
      <Toast message={snackMessage} severity="success" onClose={() => setSnackMessage('')} />
    </>
  );
};

export default CodeExportDialog;