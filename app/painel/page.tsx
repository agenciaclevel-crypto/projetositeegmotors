"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, EyeOff, Users, Package, LogOut } from "lucide-react";
import { supabase, brl, formatKm, type Veiculo } from "@/lib/supabase";
import FormVeiculo from "@/components/FormVeiculo";

type Lead = {
  id: string; nome: string; telefone: string; origem: string;
  tipo: string; status: string; mensagem: string | null; criado_em: string;
};

export default function Painel() {
  const [aba, setAba] = useState<"estoque" | "leads">("estoque");
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lojaId, setLojaId] = useState<string | null>(null);
  const [editando, setEditando] = useState<Partial<Veiculo> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession();
    if (!sessao.session) return router.push("/login");

    const { data: perfil } = await supabase.from("perfis")
      .select("loja_id").eq("id", sessao.session.user.id).single();
    if (!perfil?.loja_id) { setCarregando(false); return; }
    setLojaId(perfil.loja_id);

    const [v, l] = await Promise.all([
      supabase.from("veiculos")
        .select("*, veiculo_fotos(url,url_thumb,ordem,capa)")
        .eq("loja_id", perfil.loja_id).order("criado_em", { ascending: false }),
      supabase.from("leads").select("*")
        .eq("loja_id", perfil.loja_id).order("criado_em", { ascending: false }).limit(50),
    ]);
    setVeiculos((v.data ?? []) as unknown as Veiculo[]);
    setLeads((l.data ?? []) as Lead[]);
    setCarregando(false);
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  async function alternarPublicacao(v: Veiculo) {
    await supabase.from("veiculos").update({ publicado: !(v as any).publicado }).eq("id", v.id);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este veículo? A ação não pode ser desfeita.")) return;
    await supabase.from("veiculos").delete().eq("id", id);
    carregar();
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (carregando) return <main className="p-10 text-inkDim">Carregando...</main>;

  return (
    <main className="mx-auto max-w-[1180px] px-5 py-8">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl uppercase tracking-[0.03em]">Painel da loja</h1>
        <button onClick={sair} className="inline-flex items-center gap-2 rounded-[3px] border border-linha px-4 py-2.5 text-sm text-inkDim">
          <LogOut size={15} /> Sair
        </button>
      </div>

      <div className="mb-7 flex gap-2">
        {([["estoque", "Estoque", Package], ["leads", "Leads", Users]] as const).map(([k, rot, Ic]) => (
          <button key={k} onClick={() => setAba(k)}
            className={`inline-flex items-center gap-2 rounded-[3px] px-4 py-2.5 text-sm font-medium ${
              aba === k ? "bg-ouro/15 text-ouro" : "text-inkDim"}`}>
            <Ic size={15} /> {rot}
          </button>
        ))}
      </div>

      {aba === "estoque" && (
        <>
          <button onClick={() => setEditando({})}
            className="mb-5 inline-flex items-center gap-2 rounded-[3px] bg-ouro px-5 py-3 text-sm font-semibold text-bg0">
            <Plus size={16} /> Cadastrar carro
          </button>

          <div className="grid gap-3">
            {veiculos.map((v) => (
              <div key={v.id} className="flex flex-col gap-4 rounded border border-linha bg-card p-4 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <p className="text-[15px] font-semibold">
                    {v.marca} {v.modelo} <span className="font-normal text-inkDim">{v.versao}</span>
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-inkFaint">
                    {v.ano_fabricacao}/{v.ano_modelo} · {formatKm(v.km)} · {v.veiculo_fotos?.length ?? 0} fotos
                  </p>
                </div>
                <p className="font-display text-xl text-ouro">{brl(v.preco)}</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => alternarPublicacao(v)}
                    className={`inline-flex items-center gap-2 rounded-[3px] border px-3 py-2 font-mono text-[9px] tracking-[0.1em] ${
                      (v as any).publicado ? "border-verde/45 bg-verde/15 text-[#8FC7A3]" : "border-linha bg-bg2 text-inkFaint"}`}>
                    {(v as any).publicado ? <Eye size={13} /> : <EyeOff size={13} />}
                    {(v as any).publicado ? "NO AR" : "FORA DO AR"}
                  </button>
                  <button onClick={() => setEditando(v)} aria-label="Editar"
                    className="rounded-[3px] border border-linha p-2.5"><Pencil size={14} /></button>
                  <button onClick={() => excluir(v.id)} aria-label="Excluir"
                    className="rounded-[3px] border border-linha p-2.5"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {aba === "leads" && (
        <div className="overflow-hidden rounded border border-linha bg-card">
          {leads.map((l, i) => (
            <div key={l.id} className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${i ? "border-t border-linha" : ""}`}>
              <div>
                <p className="text-[15px] font-semibold">{l.nome}</p>
                <p className="mt-1 font-mono text-[11px] text-inkFaint">
                  {l.telefone} · {l.mensagem ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {l.tipo === "reposicao" && (
                  <span className="rounded-sm border border-ouro/35 bg-ouro/10 px-2 py-1 font-mono text-[9px] tracking-[0.12em] text-ouro">REPOSIÇÃO</span>
                )}
                <span className="rounded-sm border border-linha bg-bg2 px-2 py-1 font-mono text-[9px] tracking-[0.1em] text-inkDim">
                  {l.origem.toUpperCase()}
                </span>
                <a href={`https://wa.me/55${l.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                  className="rounded-[3px] bg-zap px-3 py-2 text-xs font-semibold text-white">Responder</a>
              </div>
            </div>
          ))}
          {leads.length === 0 && <p className="p-8 text-center text-sm text-inkDim">Nenhum lead ainda.</p>}
        </div>
      )}

      {editando && lojaId && (
        <FormVeiculo veiculo={editando} lojaId={lojaId}
          fechar={() => setEditando(null)} salvo={() => { setEditando(null); carregar(); }} />
      )}
    </main>
  );
}
