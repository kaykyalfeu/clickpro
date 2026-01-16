"use client";

interface ApiConfigCardProps {
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  token: string;
  setToken: (value: string) => void;
  clientId: string;
  setClientId: (value: string) => void;
  onSave: () => void;
}

export default function ApiConfigCard({
  baseUrl,
  setBaseUrl,
  token,
  setToken,
  clientId,
  setClientId,
  onSave,
}: ApiConfigCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-3">
      <div>
        <label className="text-xs text-slate-400">API Base URL</label>
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400">Client ID</label>
        <input
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400">JWT Token</label>
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>
      <button
        type="button"
        onClick={onSave}
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 md:col-span-3"
      >
        Salvar configurações
      </button>
    </div>
  );
}
