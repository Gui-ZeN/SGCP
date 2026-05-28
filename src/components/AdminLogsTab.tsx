import React, { useState, useMemo } from 'react';
import { Search, Calendar, User as UserIcon, RefreshCw, Layers, Shield, FileSpreadsheet } from 'lucide-react';
import { SystemLog } from '../hooks/useLogs';

interface AdminLogsTabProps {
  logs: SystemLog[];
}

export const AdminLogsTab: React.FC<AdminLogsTabProps> = ({ logs }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModulo, setSelectedModulo] = useState<string>('all');
  const [selectedAcao, setSelectedAcao] = useState<string>('all');

  // Format Dates beautifully
  const formatLogDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      if (isNaN(date.getTime())) return isoStr;
      
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  };

  // Filtered Logs list
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // 1. Module filter
      if (selectedModulo !== 'all' && log.modulo !== selectedModulo) {
        return false;
      }
      // 2. Action filter
      if (selectedAcao !== 'all' && log.acao !== selectedAcao) {
        return false;
      }
      // 3. Search term
      if (searchTerm.trim() !== '') {
        const term = searchTerm.toLowerCase();
        const matchesDetail = log.detalhes?.toLowerCase().includes(term);
        const matchesUser = log.usuario?.toLowerCase().includes(term);
        const matchesId = log.id?.toLowerCase().includes(term);
        if (!matchesDetail && !matchesUser && !matchesId) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedModulo, selectedAcao, searchTerm]);

  // Unique list of modules for filtering
  const modulosDisponiveis = useMemo(() => {
    const list = new Set<string>();
    logs.forEach(l => {
      if (l.modulo) list.add(l.modulo);
    });
    return Array.from(list);
  }, [logs]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-150">
        <div className="w-full md:w-auto flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Buscar por usuário, ação ou conteúdo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs font-medium pl-9 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900/10 focus:border-slate-850 outline-none bg-white font-sans shrink-0"
          />
        </div>
        
        <div className="w-full md:w-auto flex flex-wrap gap-2">
          {/* Module Filter */}
          <select
            value={selectedModulo}
            onChange={(e) => setSelectedModulo(e.target.value)}
            className="text-xs font-bold uppercase tracking-wider px-3.5 py-3 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-850 cursor-pointer text-slate-650"
          >
            <option value="all">TODOS OS MÓDULOS</option>
            {modulosDisponiveis.map(m => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={selectedAcao}
            onChange={(e) => setSelectedAcao(e.target.value)}
            className="text-xs font-bold uppercase tracking-wider px-3.5 py-3 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-850 cursor-pointer text-slate-650"
          >
            <option value="all">TODAS AÇÕES</option>
            <option value="CRIOU">CRIAR</option>
            <option value="ALTEROU">MODIFICAR</option>
            <option value="EXCLUIU">REMOVER</option>
          </select>

          {/* Clear Filters helper */}
          {(searchTerm !== '' || selectedModulo !== 'all' || selectedAcao !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedModulo('all');
                setSelectedAcao('all');
              }}
              className="text-xs font-bold bg-slate-200 hover:bg-slate-350 text-slate-700 px-3.5 py-3 rounded-xl uppercase transition shrink-0 cursor-pointer"
            >
              Resetar
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs px-1 text-slate-450">
        <span className="font-semibold">Exibindo {filteredLogs.length} de {logs.length} registros de auditoria</span>
        <span className="font-bold flex items-center gap-1"><Shield className="w-3 h-3 text-emerald-500" /> Acesso de Admin Apenas</span>
      </div>

      {/* Audit Logs Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
        <div className="max-h-[500px] overflow-y-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              <tr>
                <th className="px-5 py-3.5 w-[20%]">Data e Hora</th>
                <th className="px-5 py-3.5 w-[22%]">Usuário / ID</th>
                <th className="px-5 py-3.5 w-[13%]">Ação</th>
                <th className="px-5 py-3.5 w-[15%]">Módulo</th>
                <th className="px-5 py-3.5 w-[30%]">Detalhes do Evento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px] font-sans">
              {filteredLogs.map(log => {
                let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                if (log.acao === 'CRIOU') badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
                if (log.acao === 'ALTEROU') badgeClass = 'bg-amber-50 text-amber-700 border-amber-100';
                if (log.acao === 'EXCLUIU') badgeClass = 'bg-rose-50 text-rose-700 border-rose-100';
                
                return (
                  <tr key={log.id} className="hover:bg-slate-50/40 transition">
                    <td className="px-5 py-3 font-mono font-medium text-slate-450">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-350 shrink-0" />
                        <span>{formatLogDate(log.timestamp)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700 truncate" title={log.usuario}>
                      <div className="flex items-center gap-1.5 truncate">
                        <UserIcon className="w-3 h-3 text-slate-350 shrink-0" />
                        <span className="truncate">{log.usuario}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase border leading-none tracking-wider ${badgeClass}`}>
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 bg-slate-50 border border-slate-150 text-slate-550 rounded font-bold uppercase text-[9px] inline-flex items-center gap-1">
                        <Layers className="w-2.5 h-2.5 text-slate-400" />
                        {log.modulo}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-medium break-words leading-relaxed">
                      {log.detalhes}
                    </td>
                  </tr>
                );
              })}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400 font-medium font-sans">
                    Nenhum registro de auditoria encontrado na busca atual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
