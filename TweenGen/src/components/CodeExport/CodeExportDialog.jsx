import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  Tabs, Tab, Box, Typography, IconButton, Tooltip, Chip, Paper,
} from '@mui/material';
import {
  ContentCopy as CopyIcon, Download as DownloadIcon,
  Close as CloseIcon, Check as CheckIcon,
  MusicNote as MusicIcon,
} from '@mui/icons-material';
import {
  useCanvasObjects, useKeyframes, useDuration, useFabricCanvas,
  useCanvasBgColor, useLoopPlayback, useCanvasBgImage,
} from '../../store/hooks';
import { useAudioFile, useAudioRegion } from '../../store/audioHooks';
import { generateAnimationCode, downloadAllFiles, copyToClipboard } from '../../utils/codeGenerator';
import { getAudioExtension } from '../../utils/audioUtils';

const CodeExportDialog = ({ open, onClose }) => {
  const [canvasObjects] = useCanvasObjects();
  const [keyframes] = useKeyframes();
  const [duration] = useDuration();
  const [fabricCanvas] = useFabricCanvas();
  const [canvasBgColor] = useCanvasBgColor();
  const [canvasBgImage] = useCanvasBgImage();
  const [loopPlayback] = useLoopPlayback();
  const [audioFile] = useAudioFile();
  const [audioRegion] = useAudioRegion();

  const [tabIndex, setTabIndex] = useState(0);
  const [copiedTab, setCopiedTab] = useState(null);

  const { html, css, javascript } = useMemo(() => {
    return generateAnimationCode(canvasObjects, keyframes, duration, loopPlayback, fabricCanvas, canvasBgColor, audioFile, audioRegion, canvasBgImage);
  }, [canvasObjects, keyframes, duration, loopPlayback, fabricCanvas, canvasBgColor, audioFile, audioRegion, canvasBgImage]);

  const handleCopy = async (text, tabName) => {
    const success = await copyToClipboard(text);
    if (success) { setCopiedTab(tabName); setTimeout(() => setCopiedTab(null), 2000); }
  };

  const handleDownloadAll = () => { downloadAllFiles(html, css, javascript, audioFile); };

  const tabs = [
    { label: 'HTML', code: html, key: 'html' },
    { label: 'CSS', code: css, key: 'css' },
    { label: 'JavaScript', code: javascript, key: 'js' },
  ];

  const audioExt = audioFile ? getAudioExtension(audioFile.fileName, audioFile.mimeType) : null;
  const audioExportName = audioFile ? `audio.${audioExt}` : null;

  const formatTime = (s) => s != null ? `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}.${Math.floor((s%1)*10)}` : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">Export Code</Typography>
          <Chip label={audioFile ? '4 files' : '3 files'} size="small" color={audioFile ? 'primary' : 'default'} variant="outlined" />
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {audioFile && (
          <Paper variant="outlined" sx={{ mx: 3, mt: 2, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'primary.light', borderColor: 'primary.main' }}>
            <MusicIcon sx={{ color: 'primary.dark' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" fontWeight={600} color="primary.dark">
                Audio: {audioExportName}
                {audioRegion && (
                  <span style={{ fontWeight: 400, marginLeft: 8 }}>
                    (trimmed: {formatTime(audioRegion.start)} → {formatTime(audioRegion.end)})
                  </span>
                )}
              </Typography>
              <Typography variant="caption" color="primary.dark" sx={{ opacity: 0.8 }}>
                Original quality preserved. Place the audio file in the same folder as HTML/CSS/JS.
              </Typography>
            </Box>
          </Paper>
        )}

        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
          {tabs.map((tab) => (<Tab key={tab.key} label={tab.label} />))}
        </Tabs>

        {tabs.map((tab, i) => (
          <Box key={tab.key} role="tabpanel" hidden={tabIndex !== i} sx={{ px: 3, py: 2 }}>
            {tabIndex === i && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                  <Button size="small" variant="outlined"
                    startIcon={copiedTab === tab.key ? <CheckIcon /> : <CopyIcon />}
                    onClick={() => handleCopy(tab.code, tab.key)}
                    color={copiedTab === tab.key ? 'success' : 'primary'}>
                    {copiedTab === tab.key ? 'Copied!' : `Copy ${tab.label}`}
                  </Button>
                </Box>
                <Box sx={{ maxHeight: 400, overflow: 'auto', bgcolor: '#1e1e1e', color: '#d4d4d4', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                  {tab.code}
                </Box>
              </>
            )}
          </Box>
        ))}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {audioFile ? `Downloads 4 files: index.html, style.css, animation.js, ${audioExportName}` : 'Downloads 3 files: index.html, style.css, animation.js'}
        </Typography>
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={handleDownloadAll}>
          Download All {audioFile ? '(4 files)' : '(3 files)'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CodeExportDialog;