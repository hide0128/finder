
import React from 'react';

interface TextAreaInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  helperText?: string;
}

export const TextAreaInput: React.FC<TextAreaInputProps> = ({
  id,
  label,
  value,
  onChange,
  placeholder = '',
  disabled = false,
  className = '',
  rows = 3,
  helperText,
}) => {
  return (
    <div className={`w-full ${className}`}>
      <label htmlFor={id} className="block text-sm font-medium text-orange-700 mb-1">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className="w-full px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg text-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed resize-y"
        aria-describedby={helperText ? `${id}-helper` : undefined}
      />
      {helperText && (
        <p id={`${id}-helper`} className="mt-1 text-xs text-neutral-600">
          {helperText}
        </p>
      )}
    </div>
  );
};