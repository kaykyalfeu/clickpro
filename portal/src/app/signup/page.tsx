"use client";

import { useState } from "react";
import Link from "next/link";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

const steps = [
  {
    id: 1,
    title: "Sign up your account",
    description: "Crie seu acesso inicial ao ClickPro.",
    active: true,
  },
  {
    id: 2,
    title: "Set up your workspace",
    description: "Organize seus clientes e canais.",
    active: false,
  },
  {
    id: 3,
    title: "Set up your profile",
    description: "Finalize dados e preferências.",
    active: false,
  },
];

export default function SignUpPage() {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  return (
    <div className={`${inter.className} min-h-screen bg-black text-white`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-6 py-10 lg:flex-row lg:items-stretch lg:gap-0">
        <section className="relative flex w-full flex-col justify-between rounded-3xl bg-gradient-to-b from-[#7c3aed] via-[#4c1d95] to-black px-10 py-12 lg:w-1/2">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/10 text-sm font-semibold">
                ●
              </div>
              <span className="text-sm font-semibold tracking-wide">OnlyPipe</span>
            </div>

            <h1 className="mt-12 text-4xl font-bold">Get Started with Us</h1>
            <p className="mt-3 text-sm text-white/70">
              Complete these easy steps to register your account.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-start gap-4 rounded-2xl px-5 py-4 shadow-lg transition-colors ${
                  step.active
                    ? "bg-white text-black"
                    : "bg-white/10 text-white/70"
                }`}
              >
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                    step.active ? "bg-black text-white" : "bg-white/20 text-white"
                  }`}
                >
                  {step.id}
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs opacity-70">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex w-full flex-col justify-center rounded-3xl bg-black px-10 py-12 lg:w-1/2 lg:px-12">
          <div className="max-w-md">
            <h2 className="text-3xl font-semibold">Sign Up Account</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Enter your personal data to create your account.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 py-3 text-sm font-medium transition hover:bg-zinc-900">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="currentColor"
                >
                  <path d="M21.35 11.1h-9.18v2.98h5.31c-.23 1.28-1.42 3.75-5.31 3.75-3.2 0-5.81-2.64-5.81-5.88s2.61-5.88 5.81-5.88c1.82 0 3.05.78 3.75 1.45l2.56-2.47C16.99 3.6 14.84 2.4 12.17 2.4 7.4 2.4 3.55 6.29 3.55 11.1s3.85 8.7 8.62 8.7c4.97 0 8.26-3.54 8.26-8.53 0-.57-.08-1.01-.18-1.44Z" />
                </svg>
                Google
              </button>
              <button className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 px-4 py-3 text-sm font-medium transition hover:bg-zinc-900">
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M12 2.5C6.75 2.5 2.5 6.74 2.5 11.95c0 4.17 2.73 7.69 6.52 8.94.48.09.65-.21.65-.47 0-.23-.01-.84-.02-1.64-2.65.58-3.21-1.29-3.21-1.29-.43-1.1-1.05-1.39-1.05-1.39-.86-.6.07-.59.07-.59.95.07 1.45 1 1.45 1 .85 1.47 2.24 1.04 2.78.8.09-.62.33-1.04.6-1.28-2.11-.24-4.33-1.07-4.33-4.74 0-1.05.37-1.9 1-2.57-.1-.24-.44-1.2.1-2.5 0 0 .82-.26 2.7.98a9.15 9.15 0 0 1 2.46-.34c.84 0 1.68.12 2.46.34 1.88-1.24 2.7-.98 2.7-.98.54 1.3.2 2.26.1 2.5.62.67 1 1.52 1 2.57 0 3.68-2.22 4.5-4.34 4.73.34.3.65.9.65 1.82 0 1.31-.02 2.37-.02 2.69 0 .26.17.57.66.47 3.78-1.25 6.51-4.77 6.51-8.94 0-5.21-4.25-9.45-9.5-9.45Z" />
                </svg>
                Github
              </button>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs text-zinc-500">
              <span className="h-px flex-1 bg-zinc-800" />
              Or
              <span className="h-px flex-1 bg-zinc-800" />
            </div>

            <form className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs text-zinc-400">First Name</label>
                  <input
                    type="text"
                    placeholder="eg. John"
                    value={formData.firstName}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, firstName: event.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs text-zinc-400">Last Name</label>
                  <input
                    type="text"
                    placeholder="eg. Francisco"
                    value={formData.lastName}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, lastName: event.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs text-zinc-400">Email</label>
                <input
                  type="email"
                  placeholder="eg. johnfrans@gmail.com"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs text-zinc-400">Password</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, password: event.target.value }))
                    }
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 pr-10 text-sm text-white placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                      <path
                        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                        strokeWidth="1.5"
                      />
                      <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                    </svg>
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-500">Must be at least 8 characters.</p>
              </div>

              <button
                type="button"
                className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Sign Up
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-zinc-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-white hover:text-zinc-200">
                Log in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
