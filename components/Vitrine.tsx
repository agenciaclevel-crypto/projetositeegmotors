"use client";

import { useMemo, useState } from "react";
import { Search, Car } from "lucide-react";
import VeiculoCard from "./VeiculoCard";
import { type Veiculo, brl } from "@/lib/supabase";

const campo = "w-full rounded-[3px] border border-linha bg-bg1 px-3 py-2.5 text-sm text-ink";
const rotulo = "mb-1.5 block font-mono text-[9px] uppercase tracking-[0.14em] text-inkFaint";

export default function Vitrine({ veiculos }: { veiculos: Veiculo[] }) {
  const [busca, setBusca] = useState("");
  const [marca, setMarca] = useState("todas");
  const [condicao, setCondicao] = useState("todos");
  const [cambio, setCambio] = useState("Todos");
  const [teto, setTeto] = useState(300000);
  const [ordem, setOrdem] = useState("destaque");

  const marcas = useMemo(
    () => Array.from(new Set(veiculos.map((v) => v.marca))).sort(), [veiculos]);

  const lista = useMemo(() => {
    let r = veiculos.filter((v) =>
      `${v.marca} ${v.modelo} ${v.versao ?? ""}`.toLowerCase().includes(busca.toLowerCase()) &&
      (marca === "todas" || v.marca === marca) &&
      (condicao === "todos" || v.condicao === condicao) &&
      (cambio === "Todos" || v.cambio === cambio) &&
      v.preco <= teto);
    if (ordem === "menor") r = [...r].sort((a, b) => a.preco - b.preco);
    if (ordem === "maior") r = [...r].sort((a, b) => b.preco - a.preco);
    if (ordem === "km") r = [...r].sort((a, b) => a.km - b.km);
    return r;
  }, [veiculos, busca, marca, condicao, cambio, teto, ordem]);

  const limpar = () => {
    setBusca(""); setMarca("todas"); setCondicao("todos"); setCambio("Todos"); setTeto(300000);
  };

  return (
    <>
      <div className="relative mt-8 max-w-[620px]">
        <Search size={18} className="absolute left-4 top-4 text-inkFaint" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por marca, modelo ou versão"
          className="w-full rounded-[3px] border border-linha bg-bg1 py-3.5 pl-11 pr-4 text-[15px] text-ink" />
      </div>

      <div className="mt-7 flex flex-wrap gap-2">
        {["todas", ...marcas].map((m) => (
          <button key={m} onClick={() => setMarca(m)}
            className={`rounded-[3px] border px-3.5 py-2 text-[13px] font-medium transition-colors ${
              marca === m ? "border-ouro bg-ouro/15 text-ouro" : "border-linha bg-bg1 text-inkDim"}`}>
            {m === "todas" ? "Todas as marcas" : m}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-3 border-t border-linha pt-7 md:grid-cols-4">
        <label><span className={rotulo}>Condição</span>
          <select value={condicao} onChange={(e) => setCondicao(e.target.value)} className={campo}>
            <option value="todos">Novos e seminovos</option>
            <option value="novo">Somente novos</option>
            <option value="seminovo">Somente seminovos</option>
          </select>
        </label>
        <label><span className={rotulo}>Câmbio</span>
          <select value={cambio} onChange={(e) => setCambio(e.target.value)} className={campo}>
            {["Todos", "Automático", "CVT", "Manual"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label><span className={rotulo}>Até {brl(teto)}</span>
          <input type="range" min={40000} max={300000} step={5000} value={teto}
            onChange={(e) => setTeto(Number(e.target.value))} className="mt-3 w-full accent-ouro" />
        </label>
        <label><span className={rotulo}>Ordenar</span>
          <select value={ordem} onChange={(e) => setOrdem(e.target.value)} className={campo}>
            <option value="destaque">Destaques primeiro</option>
            <option value="menor">Menor preço</option>
            <option value="maior">Maior preço</option>
            <option value="km">Menor quilometragem</option>
          </select>
        </label>
      </div>

      <p className="mb-5 mt-7 font-mono text-[11px] tracking-[0.1em] text-inkFaint">
        {lista.length} {lista.length === 1 ? "VEÍCULO ENCONTRADO" : "VEÍCULOS ENCONTRADOS"}
      </p>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded border border-dashed border-linha py-20">
          <Car size={30} strokeWidth={1.2} className="text-inkFaint" />
          <p className="text-[15px] text-inkDim">Nenhum carro com esses filtros.</p>
          <button onClick={limpar} className="rounded-[3px] border border-linha px-5 py-3 text-sm font-semibold">
            Limpar filtros
          </button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((v, i) => <VeiculoCard key={v.id} v={v} prioridade={i < 3} />)}
        </div>
      )}
    </>
  );
}
