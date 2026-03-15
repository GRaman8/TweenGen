import React, { useEffect } from 'react';
import { Transition } from '@headlessui/react';
import { CheckCircleIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const severityConfig = {
  success: { bg: 'bg-green-50 border-green-400', icon: CheckCircleIcon, iconColor: 'text-green-700' },
  warning: { bg: 'bg-amber-50 border-amber-400', icon: ExclamationTriangleIcon, iconColor: 'text-amber-700' },
  error: { bg: 'bg-red-50 border-red-400', icon: ExclamationTriangleIcon, iconColor: 'text-red-700' },
  info: { bg: 'bg-blue-50 border-blue-400', icon: CheckCircleIcon, iconColor: 'text-blue-700' },
};

const Toast = ({ message, severity = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (message && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [message, duration, onClose]);

  const config = severityConfig[severity] || severityConfig.success;
  const Icon = config.icon;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000]">
      <Transition
        show={!!message}
        enter="transition-all duration-200 ease-out"
        enterFrom="opacity-0 translate-y-4"
        enterTo="opacity-100 translate-y-0"
        leave="transition-all duration-150 ease-in"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-4"
      >
        <div role="alert" aria-live="polite"
          className={`flex items-center gap-3 px-5 py-3 rounded-lg border-l-4 shadow-xl ${config.bg} min-w-[280px]`}>
          <Icon className={`w-6 h-6 ${config.iconColor} shrink-0`} />
          <span className="text-sm font-medium text-gray-900 flex-1">{message}</span>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10 transition-colors"
            aria-label="Dismiss notification">
            <XMarkIcon className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </Transition>
    </div>
  );
};

export default Toast;