import React from 'react';

const Tooltip = ({ title, children, placement = 'top' }) => {
  if (!title) return <>{children}</>;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative group/tip inline-flex" role="group">
      {children}
      <div
        role="tooltip"
        className={`absolute ${positionClasses[placement] || positionClasses.top} 
          z-[9999] px-3 py-1.5 text-[13px] leading-snug font-medium
          text-white bg-gray-800 rounded-md shadow-lg
          whitespace-nowrap pointer-events-none
          opacity-0 group-hover/tip:opacity-100 
          transition-opacity duration-200 delay-300`}
      >
        {title}
      </div>
    </div>
  );
};

export default Tooltip;