/**
 * TextInputDialog — Rich text input dialog for adding/editing text objects.
 *
 * Features:
 *   - Large multi-line text input with live preview
 *   - Font size control (slider + numeric input)
 *   - Text color picker with preset swatches
 *   - Real-time preview that matches canvas rendering
 *   - Supports both "Add New Text" and "Edit Text" modes
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Box, Typography, TextField, Slider, IconButton,
  Paper, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  TextFields as TextIcon,
  FormatSize as SizeIcon,
  Palette as PaletteIcon,
  Check as CheckIcon,
} from '@mui/icons-material';

// Preset color swatches
const COLOR_SWATCHES = [
  '#000000', '#FFFFFF', '#F44336', '#E91E63', '#9C27B0',
  '#673AB7', '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39', '#FFEB3B',
  '#FFC107', '#FF9800', '#FF5722', '#795548', '#607D8B',
];

const TextInputDialog = ({ open, onClose, onSubmit, initialText = '', initialFontSize = 24, initialColor = '#000000', mode = 'add' }) => {
  const [text, setText] = useState(initialText);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [color, setColor] = useState(initialColor);
  const inputRef = useRef(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setText(initialText);
      setFontSize(initialFontSize);
      setColor(initialColor);
      // Focus the input after a short delay to ensure the dialog is mounted
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 100);
    }
  }, [open, initialText, initialFontSize, initialColor]);

  const handleSubmit = () => {
    if (text.trim()) {
      onSubmit({ text: text.trim(), fontSize, color });
    }
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isAdd = mode === 'add';
  const hasText = text.trim().length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <TextIcon />
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {isAdd ? 'Add Text' : 'Edit Text'}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2 }}>
        {/* Live Preview */}
        <Paper
          variant="outlined"
          sx={{
            mb: 3,
            p: 3,
            minHeight: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#fafafa',
            borderRadius: 2,
            borderStyle: 'dashed',
            borderColor: hasText ? 'primary.light' : 'grey.300',
            transition: 'border-color 0.2s',
            overflow: 'hidden',
          }}
        >
          {hasText ? (
            <Typography
              sx={{
                fontSize: Math.min(fontSize, 48),
                color: color,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                textAlign: 'center',
                lineHeight: 1.3,
                maxWidth: '100%',
              }}
            >
              {text}
            </Typography>
          ) : (
            <Typography
              variant="body2"
              color="text.disabled"
              sx={{ fontStyle: 'italic' }}
            >
              Preview will appear here...
            </Typography>
          )}
        </Paper>

        {/* Text Input */}
        <TextField
          inputRef={inputRef}
          label="Text Content"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          fullWidth
          multiline
          minRows={2}
          maxRows={4}
          placeholder="Type your text here..."
          variant="outlined"
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              fontSize: '1rem',
            },
          }}
          helperText="Press Enter to confirm, Shift+Enter for new line"
        />

        {/* Font Size Control */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SizeIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body2" fontWeight={600}>
              Font Size
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Slider
              value={fontSize}
              onChange={(_, v) => setFontSize(v)}
              min={8}
              max={120}
              step={1}
              sx={{ flex: 1 }}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}px`}
            />
            <TextField
              type="number"
              value={fontSize}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v) && v > 0 && v <= 200) setFontSize(v);
              }}
              size="small"
              inputProps={{ min: 8, max: 200, step: 1 }}
              sx={{ width: 80 }}
            />
          </Box>
        </Box>

        {/* Color Picker */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <PaletteIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
            <Typography variant="body2" fontWeight={600}>
              Text Color
            </Typography>
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                bgcolor: color,
                border: '2px solid',
                borderColor: 'divider',
                ml: 0.5,
              }}
            />
          </Box>

          {/* Color swatches */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            {COLOR_SWATCHES.map((swatch) => {
              const isSelected = color.toLowerCase() === swatch.toLowerCase();
              return (
                <Tooltip key={swatch} title={swatch} placement="top">
                  <Box
                    onClick={() => setColor(swatch)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      bgcolor: swatch,
                      border: '2px solid',
                      borderColor: isSelected ? 'primary.main' : swatch === '#FFFFFF' ? 'grey.300' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '&:hover': {
                        transform: 'scale(1.15)',
                        boxShadow: 2,
                      },
                    }}
                  >
                    {isSelected && (
                      <CheckIcon
                        sx={{
                          fontSize: 18,
                          color: swatch === '#FFFFFF' || swatch === '#FFEB3B' || swatch === '#CDDC39' || swatch === '#FFC107'
                            ? '#333'
                            : '#fff',
                        }}
                      />
                    )}
                  </Box>
                </Tooltip>
              );
            })}
          </Box>

          {/* Custom color input */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="caption" color="text.secondary">
              Custom:
            </Typography>
            <TextField
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              size="small"
              sx={{
                width: 50,
                '& input': { cursor: 'pointer', p: 0.5, height: 32 },
              }}
            />
            <TextField
              value={color}
              onChange={(e) => {
                const v = e.target.value;
                if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v);
              }}
              size="small"
              sx={{ width: 100 }}
              placeholder="#000000"
            />
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {fontSize}px • {color}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!hasText}
            startIcon={isAdd ? <TextIcon /> : <CheckIcon />}
            sx={{
              borderRadius: 2,
              px: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd6 0%, #6a4296 100%)',
              },
            }}
          >
            {isAdd ? 'Add Text' : 'Update'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default TextInputDialog;