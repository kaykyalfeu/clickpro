import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 text-white">
      <main className="flex flex-col items-center gap-8 px-6 text-center">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-violet-600 flex items-center justify-center text-2xl font-bold shadow-lg shadow-violet-500/30">
            CP
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">ClickPro Portal</h1>
            <p className="text-slate-400 text-lg">Sistema de Licenciamento</p>
          </div>
        </div>

        <p className="max-w-md text-slate-300 leading-relaxed">
          Gerencie licenças, acompanhe métricas de uso e administre seus clientes
          em um único lugar.
        </p>

        <div className="flex gap-4 mt-4">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 transition-colors"
          >
            Entrar
          </Link>
          <Link
            href="/signup"
            className="px-6 py-3 rounded-xl border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors"
          >
            Criar conta
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-violet-600 text-white font-semibold hover:bg-violet-500 transition-colors shadow-lg shadow-violet-500/30"
          >
            Ir para Dashboard
          </Link>
          <Link
            href="/conversations"
            className="px-6 py-3 rounded-xl bg-slate-800 text-white font-semibold hover:bg-slate-700 transition-colors"
          >
            Inbox
          </Link>
          <Link
            href="/credentials"
            className="px-6 py-3 rounded-xl border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors"
          >
            Credenciais
          </Link>
          <Link
            href="/templates"
            className="px-6 py-3 rounded-xl border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors"
          >
            Templates
          </Link>
          <Link
            href="/campaigns"
            className="px-6 py-3 rounded-xl border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors"
          >
            Campanhas
          </Link>
          <Link
            href="/contacts"
            className="px-6 py-3 rounded-xl border border-slate-700 text-white font-semibold hover:bg-slate-800 transition-colors"
          >
            Contatos
          </Link>
        </div>

        <p className="text-sm text-slate-500 mt-8">
          &copy; {new Date().getFullYear()} ClickPro. Todos os direitos reservados.
        </p>
      </main>
    </div>
  );
}
