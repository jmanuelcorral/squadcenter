import { useState, useEffect } from 'react';
import { Cloud, Eye, EyeOff } from 'lucide-react';
import { getAzureAccount } from '../lib/api';
import type { AzureAccount } from '../lib/api';

function obfuscateEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local[0]}***@${domain[0]}***.${domain.split('.').pop()}`;
}

function obfuscateGuid(guid: string): string {
  if (guid.length < 8) return '****';
  return `${guid.slice(0, 4)}****-****-****-****-****${guid.slice(-4)}`;
}

export default function AzureAccountPanel() {
  const [account, setAccount] = useState<AzureAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    getAzureAccount()
      .then((data) => setAccount(data))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="border-b border-white/5 px-4 py-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Cloud className="w-3.5 h-3.5 text-slate-400" />
        <h2 className="text-xs font-semibold text-slate-300">Azure</h2>
        {account && (
          <button
            onClick={() => setRevealed((v) => !v)}
            className="ml-auto p-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
            title={revealed ? 'Hide details' : 'Show details'}
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-4 rounded bg-slate-800/60 animate-pulse" />
          ))}
        </div>
      ) : !account ? (
        <p className="text-[11px] text-slate-500 italic">Not connected</p>
      ) : (
        <div className="space-y-1.5">
          {/* User */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">User</span>
            <p className="text-xs text-slate-300 font-mono truncate">
              {revealed ? account.user : obfuscateEmail(account.user)}
            </p>
          </div>

          {/* Tenant */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">Tenant</span>
            <p className="text-xs text-slate-300 font-mono truncate">
              {revealed
                ? account.tenantId
                : obfuscateGuid(account.tenantId)}
            </p>
            {account.tenantName && (
              <p className="text-[11px] text-slate-400 truncate">{account.tenantName}</p>
            )}
          </div>

          {/* Subscription */}
          {account.subscriptionName && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-500">Subscription</span>
              <p className="text-xs text-slate-300 truncate">{account.subscriptionName}</p>
              {revealed && account.subscriptionId && (
                <p className="text-[10px] text-slate-500 font-mono truncate">{account.subscriptionId}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
