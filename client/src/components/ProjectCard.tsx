import { useNavigate } from 'react-router-dom';
import type { Project } from '@shared/types';

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/project/${project.id}`)}
      className="group relative flex flex-col rounded-xl bg-slate-800/60 ring-1 ring-white/10 p-5 text-left transition-all duration-200 hover:ring-emerald-500/50 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-emerald-500/5"
    >
      {/* Gradient top border */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-500/60 via-violet-500/60 to-emerald-500/0 rounded-t-xl" />

      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors truncate">
          {project.name}
        </h3>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            project.status === 'active'
              ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20'
              : 'bg-slate-700/50 text-slate-400 ring-1 ring-slate-600/30'
          }`}
        >
          {project.status}
        </span>
      </div>

      <p className="mt-1 text-xs text-slate-500 font-mono truncate">{project.path}</p>

      {project.description && (
        <p className="mt-2 text-sm text-slate-400 line-clamp-2">{project.description}</p>
      )}

      {/* Team member emoji row */}
      {project.team && project.team.length > 0 && (
        <div className="mt-4 flex items-center gap-1.5">
          {project.team.slice(0, 6).map((member) => (
            <div
              key={member.name}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700/60 text-sm ring-1 ring-white/5"
              title={`${member.emoji} ${member.name} — ${member.role}`}
            >
              {member.emoji}
            </div>
          ))}
          {project.team.length > 6 && (
            <span className="text-xs text-slate-500 ml-1">+{project.team.length - 6}</span>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-slate-500">
        Updated {timeAgo(project.updatedAt)}
      </p>
    </button>
  );
}
