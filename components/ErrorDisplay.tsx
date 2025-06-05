
import React from 'react';
import { AlertTriangleIcon } from './Icons';

interface ErrorDisplayProps {
  message: string;
  className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      className={`bg-red-700 border border-red-600 text-red-100 px-4 py-3 rounded-lg relative shadow-lg ${className}`}
      role="alert"
    >
      <div className="flex items-center">
        <AlertTriangleIcon className="h-6 w-6 text-red-300 mr-3 flex-shrink-0" />
        <div>
            <strong className="font-bold block sm:inline">エラーが発生しました</strong>
            <span className="block sm:inline ml-1" style={{ whiteSpace: 'pre-line' }}>{message}</span>
        </div>
      </div>
    </div>
  );
};
