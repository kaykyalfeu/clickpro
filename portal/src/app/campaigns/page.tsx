import { getServerSession } from "next-auth";
import CampaignsClient from "./CampaignsClient";
import { authOptions } from "@/lib/auth";
import { checkClientLicense } from "@/lib/license.server";
import { canImportContacts } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "CLIENT_ADMIN";

  let hasActiveLicense = false;
  if (session?.user?.clientId) {
    const licenseStatus = await checkClientLicense(session.user.clientId);
    hasActiveLicense = licenseStatus.isValid;
  }

  const canImport = canImportContacts({ isAdmin, hasActiveLicense });

  return <CampaignsClient canImportContacts={canImport} />;
}
