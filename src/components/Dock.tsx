import type { ReactNode } from 'react';

/** A glass panel docked on the left of the map (a bottom sheet on phones) that can be tucked away. */
export function Dock({ title, open, onToggle, children }: { title: ReactNode; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <aside className={`dock ${open ? 'open' : 'closed'}`}>
      <div className="dock-head">
        <div className="dock-title">{title}</div>
        <button className="dock-toggle" onClick={onToggle} aria-expanded={open} title={open ? 'Tuck the panel away' : 'Show the panel'}>{open ? '‹' : '›'}</button>
      </div>
      <div className="dock-body">{children}</div>
    </aside>
  );
}
