"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

const campo = "w-full rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink";
const rotulo = "mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar() {
    setCarregando(true); setErro("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) return setErro("E-mail ou senha incorretos.");
    router.push("/painel");
    router.refresh();
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-5">
      <div className="w-full max-w-[380px] rounded border border-linha bg-card p-7">
        <div className="mb-5 flex items-center gap-2 font-mono text-[9px] tracking-[0.14em] text-inkFaint">
          <Lock size={13} /> ACESSO AO PAINEL
        </div>
        <label><span className={rotulo}>E-mail</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email"
            autoComplete="email" className={campo} /></label>
        <label className="mt-4 block"><span className={rotulo}>Senha</span>
          <input value={senha} onChange={(e) => setSenha(e.target.value)} type="password"
            autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && entrar()} className={campo} /></label>
        {erro && <p className="mt-3 text-xs text-[#C25454]">{erro}</p>}
        <button onClick={entrar} disabled={carregando || !email || !senha}
          className="mt-5 w-full rounded-[3px] bg-ouro py-3 text-sm font-semibold text-bg0 disabled:opacity-45">
          {carregando ? "Entrando..." : "Entrar"}
        </button>
      </div>
    </main>
  );
}
