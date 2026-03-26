import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { fetchTeam } from '../lib/api';
import type { TeamMember } from '@shared/types';
import CollapsiblePanel from './CollapsiblePanel';

interface SidebarTeamPanelProps {
  projectId: string;
  compact?: boolean;
}

const statusDot: Record<string, string> = {
  idle: 'bg-emerald-400',
  working: 'bg-violet-400',
  done: 'bg-slate-400',
};

export default function SidebarTeamPanel({ projectId }: SidebarTeamPanelProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchTeam(projectId)
      .then((data) => setMembers(data ?? []))
      .catch(() => setError(true));
  }, [projectId]);

  return (
    <CollapsiblePanel
      title="Team"
      icon={<Users className="w-3.5 h-3.5" />}
      badge={
        members.length > 0 ? (
          <span className="text-[10px] text-slate-500 font-mono">{members.length}</span>
        ) : undefined
      }
    >
      {error ? (
        <p className="px-4 pb-3 text-[11px] text-slate-500 italic">No team configured</p>
      ) : members.length === 0 ? (
        <p className="px-4 pb-3 text-[11px] text-slate-500 italic">No team configured</p>
      ) : (
        <div className="px-3 pb-2 space-y-0.5">
          {members.map((member) => (
            <div
              key={member.name}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-white/5 transition-colors"
            >
              <span className="text-sm leading-none">{member.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate">{member.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{member.role}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <div
                  className={`h-1.5 w-1.5 rounded-full ${statusDot[member.status] ?? 'bg-slate-500'} ${
                    member.status === 'working' ? 'animate-pulse' : ''
                  }`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
