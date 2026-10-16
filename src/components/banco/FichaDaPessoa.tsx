/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * A ficha de uma pessoa no Banco de candidatos: cada vez que foi chamada, como
 * foi, e o "Nunca mais chamar" (marcar com motivo; desfazer, também com
 * motivo, só Coordenador e Administrador). Uma por vez para o app inteiro —
 * quem abre é o selo, a lista do Banco ou o nome numa lista do dia.
 */
import { useState } from 'react';
import { useBanco } from '../../hooks/useBancoCandidatos';
import { Modal } from '../ui/Modal';
import { Atalho } from '../ui/Atalhos';
import { rotuloDoResultado, CONTRATACOES } from '../../utils/candidatos';
import { MOTIVOS_NAO_CHAMAR, formatarTelefone, normalizarTelefone } from '../../utils/bancoCandidatos';

const quando = (em: any) => {
  const d = em?.toDate ? em.toDate() : em ? new Date(em) : null;
  return d && !isNaN(d.getTime()) ? d.toLocaleDateString('pt-BR') : '';
};

export function FichaDaPessoa() {
  const banco = useBanco();
  const [motivo, setMotivo] = useState<string>('');
  const [outro, setOutro] = useState('');
  const [telefone, setTelefone] = useState('');
  const [desfazendo, setDesfazendo] = useState('');
  const [desfazerAberto, setDesfazerAberto] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [unidadeEscolhida, setUnidadeEscolhida] = useState<'colegio' | 'universidade' | ''>('');
  if (!banco?.ficha) return null;
  const { ficha, fecharFicha } = banco;
  const p = ficha.pessoa;
  const tel = ficha.telefone || p?.telefone || '';
  const marca = banco.marcaPara(ficha.nome, tel);
  // A unidade da marca (revisão de segurança, 16/10/2026): quem não é Admin
  // grava SEMPRE a própria; o Admin, a das convocações da pessoa — e escolhe
  // quando ela tem convocações nas duas unidades, ou nenhuma. Nunca supor
  // "Colégio": a marca de alguém da Universidade apareceria para o Colégio.
  const unidades = [...new Set((p?.convocacoes || []).map(x => x.candidato.escopo).filter(Boolean))] as ('colegio' | 'universidade')[];
  const escopo = banco.unidadeDoLeitor ?? (unidades.length === 1 ? unidades[0] : (unidadeEscolhida || undefined));
  const precisaEscolherUnidade = !banco.unidadeDoLeitor && unidades.length !== 1;
  const fechar = () => { setUnidadeEscolhida(''); setMarcando(false); setMotivo(''); setOutro(''); setTelefone(''); setDesfazendo(''); setDesfazerAberto(false); setErro(''); fecharFicha(); };
  const textoMotivo = motivo === 'Outro' ? `Outro: ${outro.trim()}` : motivo;
  const podeMarcar = !!motivo && (motivo !== 'Outro' || outro.trim().length >= 3) && !!escopo;

  const executar = async (acao: () => Promise<void>) => {
    setSalvando(true); setErro('');
    try { await acao(); setMarcando(false); setDesfazendo(''); setDesfazerAberto(false); }
    catch (e: any) { setErro(e?.message || 'Não foi possível salvar.'); }
    finally { setSalvando(false); }
  };

  return (
    <Modal titulo={p?.nome || ficha.nome} largura="lg" aoFechar={fechar}
      antes={<>Banco de candidatos · {tel ? formatarTelefone(tel) : 'sem telefone'}</>}
      rodape={<button type="button" className="btn" onClick={fechar}>Fechar</button>}>
      {p?.soPeloNome && (
        <p className="text-[13px] mb-3" style={{ color: 'var(--tinta-3)' }}>
          Sem telefone: o histórico junta todas as convocações com este nome — pode haver pessoas diferentes com o mesmo nome. Confira a data e o cargo.
        </p>
      )}

      {/* Nunca mais chamar */}
      {marca ? (
        <div className="nao-chamar-caixa">
          <p className="font-bold">Não chamar{marca.peloNome ? ' (marcado para este nome)' : ''}</p>
          <p>{marca.marca.motivo}</p>
          <p className="sub">Marcado por {marca.marca.por}{quando(marca.marca.em) ? ` em ${quando(marca.marca.em)}` : ''}</p>
          {banco.desfazer && (
            desfazerAberto ? (
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="flex-1 min-w-[220px]">
                  <span className="rotulo">Por que desfazer?</span>
                  <input className="campo" value={desfazendo} onChange={e => setDesfazendo(e.target.value)} maxLength={300} autoFocus />
                </label>
                <button type="button" className="btn btn-primario" disabled={salvando || desfazendo.trim().length < 5}
                  onClick={() => executar(() => banco.desfazer!(marca.marca.id, desfazendo))}>Desfazer</button>
              </div>
            ) : (
              <button type="button" className="btn btn-sm mt-2" onClick={() => setDesfazerAberto(true)}>Desfazer a marcação</button>
            )
          )}
        </div>
      ) : banco.marcar && (
        marcando ? (
          <div className="nao-chamar-caixa" data-editando>
            <p className="font-bold">Marcar "Nunca mais chamar"</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label>
                <span className="rotulo">Motivo</span>
                <select className="campo" value={motivo} onChange={e => setMotivo(e.target.value)} autoFocus>
                  <option value="">Escolha…</option>
                  {MOTIVOS_NAO_CHAMAR.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label>
                <span className="rotulo">Telefone (opcional — separa de quem tem o mesmo nome)</span>
                <input className="campo" inputMode="tel" placeholder="(85) 9…" value={telefone || (tel ? formatarTelefone(tel) : '')} onChange={e => setTelefone(e.target.value)} />
              </label>
            </div>
            {precisaEscolherUnidade && (
              <label className="block mt-2">
                <span className="rotulo">Unidade da marca</span>
                <select className="campo" value={unidadeEscolhida} onChange={e => setUnidadeEscolhida(e.target.value as any)}>
                  <option value="">Escolha…</option>
                  <option value="colegio">Colégio</option>
                  <option value="universidade">Universidade</option>
                </select>
              </label>
            )}
            {motivo === 'Outro' && (
              <label className="block mt-2">
                <span className="rotulo">Qual?</span>
                <input className="campo" value={outro} onChange={e => setOutro(e.target.value)} maxLength={250} />
              </label>
            )}
            <p className="sub mt-2">O motivo fica visível para o RH da unidade. Escreva o fato, sem julgamento.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" className="btn btn-perigo" disabled={!podeMarcar || salvando}
                onClick={() => executar(() => banco.marcar!({ nome: p?.nome || ficha.nome, telefone: normalizarTelefone(telefone) || tel, motivo: textoMotivo, escopo: escopo! }))}>
                Marcar
              </button>
              <button type="button" className="btn" onClick={() => setMarcando(false)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-sm btn-perigo mb-3" onClick={() => setMarcando(true)}>Nunca mais chamar…</button>
        )
      )}
      {erro && <p role="alert" className="text-[13px] mt-2" style={{ color: 'var(--atraso)' }}>{erro}</p>}

      {/* Histórico */}
      {!p ? (
        <p className="text-[14px] mt-3" style={{ color: 'var(--tinta-3)' }}>Nenhuma convocação com este nome.</p>
      ) : (<>
        <p className="text-[14px] mt-3 mb-2" style={{ color: 'var(--tinta-2)' }}>
          <b>{p.vezes}</b> {p.vezes === 1 ? 'convocação' : 'convocações'} · faltou <b>{p.faltas}x</b> · veio <b>{p.vieram}x</b>
          {p.contratada && <> · <b>contratado(a)</b></>}{p.noBanco && <> · <b>no banco de talentos</b></>}
        </p>
        <table className="tabela tabela-empilha">
          <thead><tr><th scope="col">Data</th><th scope="col">Cargo</th><th scope="col">Resultado</th><th scope="col">Observação</th></tr></thead>
          <tbody>
            {p.convocacoes.map(({ candidato: c, cargo, sede }) => (
              <tr key={c.id}>
                <td data-rotulo="Data" className="whitespace-nowrap">
                  <Atalho para="selecoesLista" params={{ selecao: c.selecaoId }}>{c.data}</Atalho>
                </td>
                <td data-rotulo="Cargo"><span>{cargo || '—'}{sede && <span className="sub">{sede}</span>}</span></td>
                <td data-rotulo="Resultado">
                  <span>{rotuloDoResultado(c.resultado)}
                    {c.contratado && c.contratado !== 'nao' && <span className="sub">{CONTRATACOES.find(x => x.id === c.contratado)?.rotulo}</span>}
                  </span>
                </td>
                <td data-rotulo="Observação" style={{ color: 'var(--tinta-3)' }}>{[c.motivo, c.observacao].filter(Boolean).join(' · ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>)}
    </Modal>
  );
}
