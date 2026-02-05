import { Suspense } from "react";
import AuthCard from "@/components/AuthCard";

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <AuthCard initialView="signup" />
    </Suspense>
  );
}
