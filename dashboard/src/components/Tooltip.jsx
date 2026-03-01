import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Tooltip({ text, children, position = 'top' }) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const tooltipRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const pad = 8;

    let top, left;

    if (position === 'top') {
      top = rect.top - pad;
      left = rect.left + rect.width / 2;
    } else if (position === 'bottom') {
      top = rect.bottom + pad;
      left = rect.left + rect.width / 2;
    } else if (position === 'left') {
      top = rect.top + rect.height / 2;
      left = rect.left - pad;
    } else {
      top = rect.top + rect.height / 2;
      left = rect.right + pad;
    }

    setCoords({ top, left });
  }, [position]);

  useEffect(() => {
    if (!show || !tooltipRef.current) return;

    // Clamp tooltip to stay within viewport
    const el = tooltipRef.current;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { top, left } = coords;

    // Horizontal clamping
    if (position === 'top' || position === 'bottom') {
      const halfW = r.width / 2;
      if (left - halfW < 8) left = halfW + 8;
      if (left + halfW > vw - 8) left = vw - halfW - 8;
    }
    if (position === 'left' && r.left < 8) {
      left = 8 + r.width;
    }

    // Vertical: if tooltip goes above viewport, flip to bottom
    if (position === 'top' && r.top < 4) {
      const trigger = triggerRef.current.getBoundingClientRect();
      top = trigger.bottom + 8;
    }
    // If tooltip goes below viewport, flip to top
    if (position === 'bottom' && r.bottom > vh - 4) {
      const trigger = triggerRef.current.getBoundingClientRect();
      top = trigger.top - 8;
      el.style.transform = el.style.transform.replace('translateY(0)', 'translateY(-100%)');
    }

    if (top !== coords.top || left !== coords.left) {
      setCoords({ top, left });
    }
  }, [show, coords, position]);

  const positionStyles = {
    top: { transform: 'translate(-50%, -100%)' },
    bottom: { transform: 'translate(-50%, 0)' },
    left: { transform: 'translate(-100%, -50%)' },
    right: { transform: 'translate(0, -50%)' },
  };

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex"
      onMouseEnter={() => { updatePosition(); setShow(true); }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && createPortal(
        <span
          ref={tooltipRef}
          className="fixed z-[9999] px-3 py-2 text-[11px] leading-relaxed text-gray-200 bg-dark-800/95 backdrop-blur-sm border border-glass-border rounded-lg shadow-2xl whitespace-normal max-w-[280px] w-max pointer-events-none"
          style={{
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            ...positionStyles[position],
          }}
        >
          {text}
        </span>,
        document.body
      )}
    </span>
  );
}
