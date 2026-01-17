"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface LicenseInfo {
  hasLicense: boolean;
  isValid: boolean;
  plan: string | null;
  expiresAt: string | null;
  daysRemaining: number;
}

interface LicenseStatusProps {
  enforceValid?: boolean;
  onInvalid?: () => void;
}

export default function LicenseStatus({
  enforceValid = false,
  onInvalid,
}: LicenseStatusProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    async function fetchLicenseStatus() {
      try {
        const res = await fetch("/api/license/status");
        const data = await res.json();

        if (data.ok) {
          setLicense(data.license);
          setIsSuperAdmin(data.isSuperAdmin || false);

          if (enforceValid && !data.license.isValid && !data.isSuperAdmin) {
            onInvalid?.();
          }
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchLicenseStatus();
  }, [sessionStatus, enforceValid, onInvalid]);

  if (sessionStatus === "loading" || loading) {
    return null;
  }

  if (isSuperAdmin) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium">
        Super Admin
      </div>
    );
  }

  if (!license) {
    return null;
  }

  if (!license.hasLicense) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium">
        Sem licenca
      </div>
    );
  }

  if (!license.isValid) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-medium">
        Licenca expirada
      </div>
    );
  }

  // Show warning if license expires soon (< 30 days)
  if (license.daysRemaining <= 30 && license.daysRemaining > 0) {
    return (
      <div className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium">
        Licenca expira em {license.daysRemaining} dias
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
      {license.plan?.toUpperCase() || "Ativo"}
    </div>
  );
}

// Hook version for programmatic access
export function useLicenseStatus() {
  const { status: sessionStatus } = useSession();
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;

    async function fetchLicenseStatus() {
      try {
        const res = await fetch("/api/license/status");
        const data = await res.json();

        if (data.ok) {
          setLicense(data.license);
          setIsSuperAdmin(data.isSuperAdmin || false);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    }

    fetchLicenseStatus();
  }, [sessionStatus]);

  return {
    license,
    loading,
    isSuperAdmin,
    isValid: isSuperAdmin || license?.isValid || false,
    hasLicense: isSuperAdmin || license?.hasLicense || false,
  };
}
