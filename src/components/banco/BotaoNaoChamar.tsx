/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * "Não chamar mais" direto na linha do candidato (pedido do Guilherme,
 * 16/10/2026): abre a ficha da pessoa já no formulário de motivo. Quem já
 * está marcado tem o selo vermelho ao lado do nome — o botão some.
 */
import { Ban } from 'lucide-react';
import { useBanco } from '../../hooks/useBancoCandidatos';

export function BotaoNaoChamar({ nome, telefone }: { nome: string; telefone?: string }) {
  const banco = useBanco();
  if (!banco?.marcar || banco.marcaPara(nome, telefone)) return null;
  return (
    <button type="button" onClick={e => { e.stopPropagation(); banco.abrirFicha(nome, telefone, { marcar: true }); }}
      aria-label={`Não chamar mais ${nome}`} title="Não chamar mais esta pessoa"
      className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition">
      <Ban className="w-3.5 h-3.5" />
    </button>
  );
}
