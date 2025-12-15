import React, { useEffect, useRef } from 'react';

interface ScannerListenerProps {
  onScan: (barcode: string) => void;
}

export const ScannerListener: React.FC<ScannerListenerProps> = ({ onScan }) => {
  const bufferRef = useRef<string>("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if the user is typing in a real input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Enter') {
        if (bufferRef.current.length > 0) {
          onScan(bufferRef.current);
          bufferRef.current = "";
        }
      } else if (e.key.length === 1) {
        // Append printable characters
        bufferRef.current += e.key;

        // Reset buffer if typing is too slow (human typing vs scanner)
        // Scanners typically enter characters very fast (e.g. within 20-50ms)
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          bufferRef.current = "";
        }, 100); // 100ms timeout
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onScan]);

  return null; // This component renders nothing
};