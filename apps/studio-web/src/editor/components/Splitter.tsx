import { useRef, type PointerEvent as RPE } from 'react';

/** Draggable divider. Reports incremental pixel deltas while dragging. */
export default function Splitter({
  orientation,
  onResize,
}: {
  orientation: 'v' | 'h';
  onResize: (deltaPx: number) => void;
}) {
  const last = useRef(0);
  const dragging = useRef(false);

  const onDown = (e: RPE) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    last.current = orientation === 'v' ? e.clientX : e.clientY;
    dragging.current = true;
  };
  const onMove = (e: RPE) => {
    if (!dragging.current) return;
    const cur = orientation === 'v' ? e.clientX : e.clientY;
    const d = cur - last.current;
    last.current = cur;
    if (d !== 0) onResize(d);
  };
  const onUp = (e: RPE) => {
    dragging.current = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div
      className={`splitter ${orientation}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
    />
  );
}
