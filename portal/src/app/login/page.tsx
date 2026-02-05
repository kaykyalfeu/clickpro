import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthCard initialView="signin" />
    </Suspense>
  );
}
