import { useEffect, useRef } from 'react';

export default function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  closeOnBackdrop = false,
  closeOnEscape = false,
}) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape' && open && closeOnEscape) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, closeOnEscape]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (closeOnBackdrop && e.target === overlayRef.current) onClose();
      }}
    >
      <div className={`bg-cad-surface border border-cad-border rounded-lg shadow-2xl mx-3 sm:mx-4 ${wide ? 'w-full max-w-4xl' : 'w-full max-w-2xl'} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-cad-border">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-cad-muted hover:text-cad-ink transition-colors text-xl leading-none">&times;</button>
        </div>
        <div className="px-5 sm:px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
