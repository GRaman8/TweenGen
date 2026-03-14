import React from 'react';
import { Popover, Box, Typography, ButtonBase } from '@mui/material';
import { SHAPES } from '../../utils/shapeDefinitions';

/**
 * Shape preview thumbnail — renders the shape's SVG path inside a small box.
 */
const ShapePreview = ({ svgPath, fill }) => (
  <Box
    sx={{
      width: 48,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg viewBox="0 0 100 100" width="32" height="32" style={{ overflow: 'visible' }}>
      <path d={svgPath} fill={fill} stroke="rgba(0,0,0,0.15)" strokeWidth="2" />
    </svg>
  </Box>
);

const ShapePicker = ({ anchorEl, open, onClose, onSelectShape }) => {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      slotProps={{
        paper: {
          sx: {
            width: 210,
            maxHeight: 460,
            overflowY: 'auto',
            ml: 0.5,
            borderRadius: 2,
          },
        },
      }}
    >
      <Box sx={{ py: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            px: 1.5,
            py: 0.75,
            display: 'block',
            fontWeight: 700,
            color: 'text.secondary',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Shapes
        </Typography>

        {SHAPES.map((shape) => (
          <ButtonBase
            key={shape.key}
            onClick={() => {
              onSelectShape(shape.key);
              onClose();
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              px: 1.5,
              py: 0.6,
              gap: 1,
              textAlign: 'left',
              borderRadius: 1,
              transition: 'background 0.15s',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Typography
              variant="body2"
              sx={{ flex: 1, fontSize: '0.82rem' }}
            >
              {shape.label}
            </Typography>
            <ShapePreview svgPath={shape.svgPath} fill={shape.defaultFill} />
          </ButtonBase>
        ))}
      </Box>
    </Popover>
  );
};

export default ShapePicker;