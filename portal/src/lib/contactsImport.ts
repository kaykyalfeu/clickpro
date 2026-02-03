export interface ContactsImportContext {
  baseUrl: string;
  clientId: string;
  token: string;
  csvText: string;
}

export function getContactsImportError({
  baseUrl,
  clientId,
  token,
  csvText,
}: ContactsImportContext): string | null {
  if (!baseUrl.trim()) {
    return "Informe a URL base da API.";
  }
  if (!clientId.trim()) {
    return "Informe o Client ID antes de importar.";
  }
  if (!token.trim()) {
    return "Ative sua licença para gerar o JWT antes de importar.";
  }
  if (!csvText.trim()) {
    return "Adicione um CSV antes de importar.";
  }
  return null;
}
