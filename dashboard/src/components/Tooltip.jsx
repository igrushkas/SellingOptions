import { useState } from 'react';

export default function Tooltip({ text, children, position = 'top' }) {
  const [show, setShow] = useState(false);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span className={`absolute z-50 px-3 py-2 text-[11px] leading-relaxed text-gray-200 bg-dark-800 border border-glass-border rounded-lg shadow-xl whitespace-normal max-w-[260px] w-max pointer-events-none ${positionClasses[position]}`}>
          {text}
        </span>
      )}
    </span>
  );
}
