interface ContactsEmptyStateProps {
  isAuthenticated: boolean;
  importHref?: string;
}

export default function ContactsEmptyState({
  isAuthenticated,
  importHref = "/contacts",
}: ContactsEmptyStateProps) {
  return (
    <div className="space-y-2 text-sm text-slate-400">
      <p title="Nenhum contato importado">Nenhum contato disponível. Importe contatos primeiro.</p>
      {isAuthenticated && (
        <a
          href={importHref}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 transition-colors"
          title="Ir para a tela de importação de contatos"
        >
          Importar contatos
        </a>
      )}
    </div>
  );
}
