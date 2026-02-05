interface ContactsEmptyStateProps {
  isAuthenticated: boolean;
  importHref: string;
  canImportContacts?: boolean;
  showPermissionMessage?: boolean;
}

export default function ContactsEmptyState({
  isAuthenticated,
  importHref,
  canImportContacts = true,
  showPermissionMessage = false,
}: ContactsEmptyStateProps) {
  return (
    <div className="space-y-2 text-sm text-slate-400">
      <p title="Nenhum contato importado">
        Nenhum contato disponível. Importe contatos primeiro.
      </p>
      {isAuthenticated &&
        (canImportContacts ? (
          <a
            href={importHref}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
            title="Ir para a tela de importação de contatos"
          >
            Importar contatos
          </a>
        ) : showPermissionMessage ? (
          <p className="text-xs text-amber-300" title="Sem permissão para importar contatos">
            Sem permissão para importar. Contate o administrador.
          </p>
        ) : null)}
    </div>
  );
}
