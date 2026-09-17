/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Monta o e-mail "Seleções do dia" que o RH recebe às 18h.
 *
 * Função PURA e separada do envio de propósito: o que precisa de teste aqui é o
 * conteúdo — quem apareceu, quanto foi, o que ficou pendente — e não o SMTP.
 * O disparo (`api/selecoes-do-dia.ts`) só entrega o que sai daqui.
 *
 * HTML de e-mail não é HTML de página: tabela com `cellpadding`, estilo inline
 * e nada de flex/grid. Gmail e Outlook descartam `<style>` no topo e não
 * implementam layout moderno; o que sobrevive é o que parece HTML de 2003.
 */
import type { Selecao } from '../types';
import { ehRealizada, totaisDeSelecoes, codigosDasVagas } from './selecao';

export interface EmailSelecoes {
  assunto: string;
  html: string;
  /** Alternativa em texto puro — quem lê no relógio ou bloqueia HTML. */
  texto: string;
  /** false quando não há nada no dia e o e-mail não deve ser enviado. */
  vale: boolean;
}

const escapar = (t: string) =>
  String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/**
 * @param dia   DD/MM/AAAA — o dia do resumo
 * @param selecoes  já escopadas por unidade por quem chama
 */
export function montarEmailSelecoes(dia: string, selecoes: Selecao[]): EmailSelecoes {
  const doDia = selecoes.filter(s => (s.data || '').trim() === dia);
  const realizadas = doDia.filter(ehRealizada);
  const agendadas = doDia.filter(s => !ehRealizada(s));
  const t = totaisDeSelecoes(doDia);

  // Dia sem seleção NÃO gera e-mail. Um aviso diário que na maior parte dos
  // dias diz "nada aconteceu" é o caminho mais curto para o filtro de lixeira.
  if (doDia.length === 0) {
    return { assunto: '', html: '', texto: '', vale: false };
  }

  const resumo = [
    `${t.convocados} convocados`,
    `${t.compareceram} compareceram`,
    t.taxa !== null ? `${t.taxa}% de comparecimento` : '',
    t.contratados ? plural(t.contratados, 'contratado', 'contratados') : '',
  ].filter(Boolean).join(' · ');

  const assunto = t.convocados > 0
    ? `Seleções de ${dia} — ${t.compareceram} de ${t.convocados} compareceram`
    : `Seleções de ${dia} — ${plural(agendadas.length, 'seleção agendada', 'seleções agendadas')}`;

  const linha = (s: Selecao) => {
    const vagas = codigosDasVagas(s).map(c => `#${c}`).join(' ');
    const numeros = ehRealizada(s)
      ? `${s.convocados || 0} / ${s.compareceram || 0} / ${s.ausentes || 0}`
      : `${s.convocados || 0} / — / —`;
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b">
        <strong>${escapar(s.cargo)}</strong>${vagas ? ` <span style="color:#64748b">${escapar(vagas)}</span>` : ''}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155">${escapar(s.sede || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#334155">${escapar(s.responsavel || '—')}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#1e293b;text-align:right;white-space:nowrap">${numeros}</td>
    </tr>`;
  };

  const motivos = new Map<string, number>();
  doDia.forEach(s => Object.entries(s.motivos || {}).forEach(([m, n]) => {
    if (n > 0) motivos.set(m, (motivos.get(m) || 0) + n);
  }));

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#1e293b">
  <p style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin:0 0 4px">SGPC · Seleções do dia</p>
  <h1 style="font-size:20px;margin:0 0 2px">${escapar(dia)}</h1>
  <p style="font-size:14px;color:#334155;margin:0 0 16px"><strong>${escapar(resumo)}</strong></p>

  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid #e2e8f0">
    <thead>
      <tr style="background:#f8fafc">
        <th align="left" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Cargo</th>
        <th align="left" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Sede</th>
        <th align="left" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Responsável</th>
        <th align="right" style="padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#475569;border-bottom:1px solid #e2e8f0">Conv. / Comp. / Aus.</th>
      </tr>
    </thead>
    <tbody>${[...realizadas, ...agendadas].map(linha).join('')}</tbody>
  </table>

  ${agendadas.length ? `<p style="font-size:13px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;margin:14px 0 0">
    ${plural(agendadas.length, 'seleção ainda sem confirmação de presença', 'seleções ainda sem confirmação de presença')}.
  </p>` : ''}

  ${motivos.size ? `<p style="font-size:12px;color:#475569;margin:14px 0 0">
    <strong>Desistências:</strong> ${[...motivos.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => `${escapar(m)} (${n})`).join(' · ')}
  </p>` : ''}

  <p style="font-size:11px;color:#94a3b8;margin:20px 0 0">
    Enviado automaticamente pelo SGPC. Para mudar quem recebe: Painel Admin → Notificações.
  </p>
</div>`;

  const texto = [
    `SGPC — Seleções do dia ${dia}`,
    resumo,
    '',
    ...[...realizadas, ...agendadas].map(s => {
      const n = ehRealizada(s)
        ? `${s.convocados || 0} convocados, ${s.compareceram || 0} compareceram, ${s.ausentes || 0} ausentes`
        : `${s.convocados || 0} convocados, presença a confirmar`;
      return `- ${s.cargo} · ${s.sede || 's/ sede'} · ${s.responsavel || 's/ responsável'}: ${n}`;
    }),
    agendadas.length ? `\n${plural(agendadas.length, 'seleção sem confirmação', 'seleções sem confirmação')} de presença.` : '',
  ].filter(Boolean).join('\n');

  return { assunto, html, texto, vale: true };
}
