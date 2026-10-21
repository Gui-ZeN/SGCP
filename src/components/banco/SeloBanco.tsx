/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * O selo do Banco de candidatos ao lado de um nome: "Chamado 3x", "Última:
 * ASG · 12/05/26" e, se houver, "Não chamar" (o motivo vai no title e na
 * ficha). Clicar abre a ficha da pessoa. Fora do ProvedorBanco, nada.
 */
import { useBanco } from '../../hooks/useBancoCandidatos';

export function SeloBanco({ nome, telefone, excluir }: { nome: string; telefone?: string; excluir?: string }) {
  const banco = useBanco();
  const aviso = banco?.avisoPara(nome, telefone, excluir);
  // Consulta que falhou ≠ "nunca chamado": diz que não conferiu. Com aviso
  // parcial (só o que já estava na tela), o "Chamado Nx" sai — seria um número
  // a menos parecendo certo; o "Não chamar" fica (as marcas estão todas na tela).
  const falhou = !!banco?.falhouPara(nome, telefone) && !!nome.trim();
  if (falhou && !aviso?.naoChamar) {
    return <span className="selo-banco" title="Não foi possível consultar o histórico agora. Tenta de novo sozinho em instantes.">Histórico indisponível</span>;
  }
  if (!banco || !aviso) return null;
  if (falhou) {
    return (
      <button type="button" className="selo-banco" onClick={e => { e.stopPropagation(); banco.abrirFicha(nome, telefone); }}
        title={`Não chamar: ${aviso.naoChamar} — histórico indisponível agora`}>
        <span className="selo-banco-nao">Não chamar</span><span>Histórico indisponível</span>
      </button>
    );
  }
  return (
    <button type="button" className="selo-banco"
      onClick={e => { e.stopPropagation(); banco.abrirFicha(nome, telefone); }}
      title={aviso.naoChamar ? `Não chamar: ${aviso.naoChamar} — clique para ver o histórico` : 'Ver o histórico desta pessoa nas seleções'}>
      {aviso.naoChamar && <span className="selo-banco-nao">Não chamar</span>}
      {aviso.vezes > 0 && <span>Chamado {aviso.vezes}x</span>}
      {aviso.ultima && <span>Última: {aviso.ultima.cargo ? `${aviso.ultima.cargo} · ` : ''}{aviso.ultima.data}</span>}
    </button>
  );
}
