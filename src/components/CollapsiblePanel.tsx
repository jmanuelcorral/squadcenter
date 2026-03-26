import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsiblePanelProps {
  title: string;
  icon?: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export default function CollapsiblePanel({
  title,
  icon,
  defaultOpen = true,
  badge,
  actions,
  children,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-white/[0.02] transition-colors"
      >
        <ChevronDown
          className={`w-3 h-3 text-slate-500 transition-transform duration-200 ${
            open ? '' : '-rotate-90'
          }`}
        />
        {icon && <span className="flex-shrink-0 text-slate-400">{icon}</span>}
        <h2 className="text-xs font-semibold text-slate-300">{title}</h2>
        {badge && <span className="ml-auto">{badge}</span>}
        {actions && (
          <span
            className="ml-auto flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
