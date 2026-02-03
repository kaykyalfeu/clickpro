"use client";

interface ApiConfigCardProps {
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  licenseKey: string;
  setLicenseKey: (value: string) => void;
  onActivate: () => void;
  activationLoading: boolean;
  activationError: string | null;
  activationSuccess: string | null;
  token: string;
  setToken: (value: string) => void;
  clientId: string;
  setClientId: (value: string) => void;
  onSave: () => void;
}

export default function ApiConfigCard({
  baseUrl,
  setBaseUrl,
  licenseKey,
  setLicenseKey,
  onActivate,
  activationLoading,
  activationError,
  activationSuccess,
  token,
  setToken,
  clientId,
  setClientId,
  onSave,
}: ApiConfigCardProps) {
  return (
    <div className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-4">
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
        <label className="text-xs text-slate-400">Chave de Licença</label>
        <input
          value={licenseKey}
          onChange={(event) => setLicenseKey(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          placeholder="Cole a chave de licença para ativar"
        />
      </div>
      <div>
        <label className="text-xs text-slate-400">JWT Token</label>
        <input
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          placeholder="Gerado automaticamente após ativação"
        />
      </div>
      <div className="md:col-span-4">
        <button
          type="button"
          onClick={onActivate}
          disabled={activationLoading}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {activationLoading ? "Ativando..." : "Ativar licença e gerar JWT"}
        </button>
      </div>
      {activationError && (
        <div className="md:col-span-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {activationError}
        </div>
      )}
      {activationSuccess && (
        <div className="md:col-span-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {activationSuccess}
        </div>
      )}
      <button
        type="button"
        onClick={onSave}
        className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 md:col-span-4"
      >
        Salvar configurações
      </button>
    </div>
  );
}
