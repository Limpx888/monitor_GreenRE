import React, { useId, useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from './cn';

/**
 * Drag-and-drop / click / keyboard file picker.
 * <UploadDropzone accept="image/*" onFiles={(files) => …} title="Drop a waste photo" hint="JPG or PNG, up to 10 MB" />
 */
export function UploadDropzone({
  onFiles, accept, multiple = false, disabled = false, maxSizeMb,
  title = 'Drop a file here or click to browse', hint, icon, className, children,
}) {
  const inputRef = useRef(null);
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const handle = (fileList) => {
    let files = Array.from(fileList || []);
    if (!files.length) return;
    if (maxSizeMb) {
      const tooBig = files.find((f) => f.size > maxSizeMb * 1024 * 1024);
      if (tooBig) {
        setError(`${tooBig.name} is larger than ${maxSizeMb} MB.`);
        return;
      }
    }
    if (!multiple) files = files.slice(0, 1);
    setError('');
    onFiles?.(files);
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-describedby={hintId}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handle(e.dataTransfer.files);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center',
          'transition-[border-color,background-color] duration-base ease-standard',
          dragging ? 'border-primary bg-primary-soft' : 'border-line-strong bg-surface-2 hover:border-subtle',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <span className={cn('flex size-12 items-center justify-center rounded-full', dragging ? 'bg-primary text-on-brand' : 'bg-surface text-muted')} aria-hidden="true">
          {icon || <UploadCloud className="size-6" />}
        </span>
        <div>
          <p className="font-semibold text-fg">{dragging ? 'Release to upload' : title}</p>
          <p id={hintId} className="text-sm text-muted mt-1">{hint}</p>
        </div>
        {children}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { handle(e.target.files); e.target.value = ''; }}
      />
      {error && <p role="alert" className="mt-2 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
