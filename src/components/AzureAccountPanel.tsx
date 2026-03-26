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

const stateStyles: Record<string, { dot: string; text: string }> = {
  Enabled:  { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  Disabled: { dot: 'bg-red-400',     text: 'text-red-300' },
  default:  { dot: 'bg-amber-400',   text: 'text-amber-300' },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[10px] text-slate-500 w-16 flex-shrink-0">{label}</span>
      <span className="text-xs text-slate-300 truncate text-right">{children}</span>
    </div>
  );
}

export default function AzureAccountPanel({ sessionId }: { sessionId: string }) {
  const [account, setAccount] = useState<AzureAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    getAzureAccount(sessionId)
      .then((data) => setAccount(data))
      .catch(() => setAccount(null))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const stateKey = account?.state ?? 'default';
  const { dot, text } = stateStyles[stateKey] ?? stateStyles.default;

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
        <div className="divide-y divide-white/5">
          {/* Public info */}
          <div className="space-y-0.5 pb-1.5">
            <Row label="Subscription">
              {account.subscriptionName ?? '—'}
            </Row>

            <Row label="Tenant">
              {account.tenantName ?? '—'}
            </Row>

            {account.state && (
              <Row label="State">
                <span className={`inline-flex items-center gap-1 ${text}`}>
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
                  {account.state}
                </span>
              </Row>
            )}

            {account.cloudName && (
              <Row label="Cloud">
                <span className="rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-medium text-blue-300 ring-1 ring-blue-500/20">
                  {account.cloudName}
                </span>
              </Row>
            )}
          </div>

          {/* Sensitive info */}
          <div className="space-y-0.5 pt-1.5">
            <Row label="User">
              <span className="font-mono">
                {revealed ? account.user : obfuscateEmail(account.user)}
              </span>
            </Row>

            <Row label="Tenant ID">
              <span className="font-mono">
                {revealed ? account.tenantId : obfuscateGuid(account.tenantId)}
              </span>
            </Row>

            {revealed && account.subscriptionId && (
              <Row label="Sub ID">
                <span className="font-mono text-[10px] text-slate-500">
                  {account.subscriptionId}
                </span>
              </Row>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
