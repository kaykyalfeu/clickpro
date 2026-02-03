"use client";

import { useEffect, useState } from "react";
import ApiConfigCard from "@/components/ApiConfigCard";
import DashboardHeader from "@/components/DashboardHeader";
import * as ExcelJS from "exceljs";

interface PreviewRow {
  name?: string;
  phone?: string;
  email?: string;
}

const defaultBaseUrl = process.env.NEXT_PUBLIC_CLICKPRO_API_URL || "http://localhost:3001";

export default function ContactsPage() {
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);
  const [token, setToken] = useState("");
  const [clientId, setClientId] = useState("");
  const [csvText, setCsvText] = useState("");
  const [excelDataBase64, setExcelDataBase64] = useState<string | null>(null); // base64 encoded Excel
  const [fileType, setFileType] = useState<"csv" | "excel">("csv");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("clickpro-config");
    if (stored) {
      const config = JSON.parse(stored) as { baseUrl?: string; token?: string; clientId?: string };
      if (config.baseUrl) setBaseUrl(config.baseUrl);
      if (config.token) setToken(config.token);
      if (config.clientId) setClientId(config.clientId);
    }
  }, []);

  function saveConfig() {
    localStorage.setItem(
      "clickpro-config",
      JSON.stringify({ baseUrl, token, clientId }),
    );
    setFeedback("Configurações salvas localmente.");
  }

  function parseCsvPreview(text: string) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
    return lines.slice(1, 6).map((line) => {
      const values = line.split(",");
      const row: PreviewRow = {};
      headers.forEach((header, index) => {
        if (header.includes("name") || header.includes("nome")) row.name = values[index];
        if (header.includes("phone") || header.includes("telefone") || header.includes("numero")) {
          row.phone = values[index];
        }
        if (header.includes("email")) row.email = values[index];
      });
      return row;
    });
  }

  async function parseExcelPreview(buffer: ArrayBuffer): Promise<PreviewRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount === 0) return [];
    
    const headerRow = worksheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value || '').trim().toLowerCase();
    });
    
    const rows: PreviewRow[] = [];
    const maxRows = Math.min(6, worksheet.rowCount);
    
    for (let rowNumber = 2; rowNumber <= maxRows; rowNumber++) {
      const dataRow = worksheet.getRow(rowNumber);
      const row: PreviewRow = {};
      dataRow.eachCell((cell, colNumber) => {
        const header = headers[colNumber - 1];
        const value = String(cell.value || '').trim();
        
        if (header.includes("name") || header.includes("nome")) row.name = value;
        if (header.includes("phone") || header.includes("telefone") || header.includes("numero")) {
          row.phone = value;
        }
        if (header.includes("email")) row.email = value;
      });
      
      if (Object.values(row).some(val => val)) {
        rows.push(row);
      }
    }
    
    return rows;
  }

  async function handleFile(file: File) {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      setCsvText(text);
      setExcelDataBase64(null);
      setFileType("csv");
      setPreviewRows(parseCsvPreview(text));
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      // Convert ArrayBuffer to base64 using browser-compatible method
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      setExcelDataBase64(base64);
      setCsvText("");
      setFileType("excel");
      setPreviewRows(await parseExcelPreview(buffer));
    } else {
      setError('Formato de arquivo não suportado. Use .csv, .xlsx ou .xls');
    }
  }

  async function uploadContacts() {
    setFeedback(null);
    setError(null);
    try {
      const body = fileType === "csv" 
        ? JSON.stringify({ csv: csvText })
        : JSON.stringify({ excel: excelDataBase64 });
        
      const response = await fetch(`${baseUrl}/api/clients/${clientId}/contacts/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao importar contatos.");
      setFeedback(`Importados ${data.inserted} contatos (de ${data.total}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar contatos.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <DashboardHeader />

      <div className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold" title="Área para importar contatos para suas campanhas">Upload de Contatos</h1>
            <p className="text-sm text-slate-400" title="Seus contatos serão validados e duplicatas serão removidas automaticamente">
              Faça upload CSV, valide e dedupe contatos antes das campanhas.
            </p>
          </div>
          <ApiConfigCard
            baseUrl={baseUrl}
            setBaseUrl={setBaseUrl}
            token={token}
            setToken={setToken}
            clientId={clientId}
            setClientId={setClientId}
            onSave={saveConfig}
          />
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Instruções de importação */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-2" title="Área para importar contatos para suas campanhas">Importar contatos</h2>
          <p className="text-sm text-slate-400 mb-4" title="Instruções para preparar seu arquivo CSV ou Excel">
            Envie sua lista de contatos em formato CSV ou Excel (.xlsx, .xls). Use colunas com cabeçalhos:
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <code className="rounded bg-slate-800 px-2 py-1 text-xs text-emerald-400" title="Nome do contato (opcional)">name</code>
            <code className="rounded bg-slate-800 px-2 py-1 text-xs text-emerald-400" title="Número com DDI e DDD (obrigatório)">phone</code>
            <code className="rounded bg-slate-800 px-2 py-1 text-xs text-emerald-400" title="Email válido do contato (opcional)">email</code>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <p className="text-xs text-slate-500 mb-2" title="Exemplo de como montar seu arquivo">Exemplo de arquivo CSV ou Excel:</p>
            <pre className="text-xs text-slate-400 font-mono" title="Copie este formato para criar seu arquivo">
{`name,phone,email
João Silva,5511999999999,joao@email.com
Ana Costa,5511888888888,ana@email.com
Pedro Santos,5521777777777,pedro@email.com`}
            </pre>
          </div>
          <p className="mt-3 text-xs text-slate-500" title="Dica importante sobre formato do telefone">
            ⚠️ O número deve incluir código do país + DDD + número (sem espaços, parênteses ou traços)
          </p>
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold" title="Faça upload ou cole seus contatos aqui">Importação</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-xs text-slate-400" title="Selecione um arquivo CSV ou Excel do seu computador">Arquivo (CSV ou Excel)</label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="mt-2 text-sm text-slate-300"
                title="Clique para selecionar um arquivo .csv, .xlsx ou .xls"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400" title="Ou cole o conteúdo diretamente aqui">Conteúdo CSV (opcional)</label>
              <textarea
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  setExcelDataBase64(null);
                  setFileType("csv");
                  setPreviewRows(parseCsvPreview(event.target.value));
                }}
                className="mt-2 h-40 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Cole o conteúdo CSV aqui"
                title="Cole o conteúdo do seu arquivo CSV ou edite diretamente"
              />
              <p className="mt-1 text-xs text-slate-500" title="Dica de uso">Você pode editar o conteúdo CSV diretamente antes de importar (não funciona com Excel)</p>
            </div>
            <button
              type="button"
              onClick={uploadContacts}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-slate-200"
              title="Enviar contatos para o sistema"
            >
              Importar contatos
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
          <h2 className="text-lg font-semibold" title="Prévia dos primeiros contatos do arquivo">Prévia (primeiras linhas)</h2>
          <p className="mt-1 text-xs text-slate-500" title="Informação sobre a prévia">Mostrando até 5 primeiros contatos para verificação</p>
          <div className="mt-4 space-y-3">
            {previewRows.length === 0 && (
              <p className="text-sm text-slate-400" title="Nenhum contato carregado ainda">Nenhum contato para prévia. Faça upload de um arquivo CSV ou Excel.</p>
            )}
            {previewRows.map((row, index) => (
              <div key={index} className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm" title="Dados do contato extraídos do CSV">
                <p title="Nome do contato">{row.name || "(sem nome)"}</p>
                <p className="text-xs text-slate-400" title="Número de telefone">{row.phone || "(sem telefone)"}</p>
                <p className="text-xs text-slate-500" title="Email do contato">{row.email || "(sem email)"}</p>
              </div>
            ))}
          </div>
        </section>

        {(feedback || error) && (
          <div className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${
            error
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}>
            {error || feedback}
          </div>
        )}
      </main>
    </div>
  );
}
