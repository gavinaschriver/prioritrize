import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverWidth = 272; // w-68 = 17rem = 272px
    // Center horizontally on the button, but clamp to viewport
    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - popoverWidth - 8));
    setPos({ top: rect.top - 8, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const handleClickOutside = (e: MouseEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(e.target as Node) &&
        popoverRef.current && !popoverRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  return (
    <span className="inline-flex ml-1">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-500 hover:text-gray-700 text-[10px] font-bold leading-none transition-colors"
        aria-label="More info"
      >
        ?
      </button>
      {open && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-[9999] w-68 px-3 py-2.5 text-xs leading-relaxed text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg"
          style={{ top: pos.top, left: pos.left, transform: 'translateY(-100%)' }}
        >
          {text}
        </div>,
        document.body,
      )}
    </span>
  );
}
