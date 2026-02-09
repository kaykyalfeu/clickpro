export interface ImportContactsPermissionContext {
  isAdmin: boolean;
  hasActiveLicense: boolean;
}

export function canImportContacts({
  isAdmin,
  hasActiveLicense,
}: ImportContactsPermissionContext): boolean {
  return isAdmin || hasActiveLicense;
}
