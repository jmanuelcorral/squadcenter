import type { TeamMember } from '@shared/types';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface Props {
  members: TeamMember[];
}

export default function TeamPanel({ members }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-slate-500">
        <p className="text-sm">No team members yet</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-white/5">
      {members.map((member) => {
        const isExpanded = expanded === member.name;

        return (
          <div key={member.name}>
            <button
              onClick={() => setExpanded(isExpanded ? null : member.name)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-all duration-200"
            >
              {/* Avatar */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/80 text-lg ring-1 ring-white/10">
                {member.emoji}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{member.name}</p>
                <p className="text-xs text-slate-500 truncate">{member.role}</p>
              </div>

              {/* Expand icon */}
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-3 pb-3 pl-15 space-y-2">
                {member.currentTask && (
                  <div className="rounded-lg bg-violet-500/5 ring-1 ring-violet-500/10 px-3 py-2">
                    <p className="text-[10px] font-medium text-violet-400 uppercase tracking-wider mb-0.5">Current Task</p>
                    <p className="text-xs text-slate-300">{member.currentTask}</p>
                  </div>
                )}
                <div className="text-xs text-slate-500">
                  <p>{member.role}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
