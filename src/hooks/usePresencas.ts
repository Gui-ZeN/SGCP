/**
 * Presença por nome nas turmas da Infra (28/10/2026).
 *
 * `presencas/{idDaTurma}` só editor lê (nomes e matrículas); o Realizado fica
 * na turma, que todos leem. Os dois vão no MESMO lote: a contagem e a lista
 * nunca divergem. O quadro vem de `/api/quadro-infra` (Chromos, só ASG ativos).
 */
import { db, doc, getDoc, updateDoc, writeBatch, auth, isFirebaseEnabled } from '../lib/firebase';
import type { Participante, Treinamento } from '../types';
import { dataISOLocal } from '../utils/date';

export interface PessoaDoQuadro { matricula: string; nome: string; sede: string; unidade: 'colegio' | 'universidade' }

export async function lerQuadroDaInfra(): Promise<PessoaDoQuadro[]> {
  if (!isFirebaseEnabled) return [];
  const token = await auth?.currentUser?.getIdToken();
  const r = await fetch('/api/quadro-infra', { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 503) throw new Error('A integração com o Chromos não está ligada.');
  if (r.status === 401) throw new Error('Sua sessão expirou: saia e entre de novo.');
  if (r.status === 403) throw new Error('Só quem edita os treinamentos vê o quadro da Infra.');
  if (!r.ok) throw new Error('O Chromos não respondeu. Tente de novo em instantes.');
  // Resposta que não é a lista (página de erro, proxy): frase para o RH, não o erro técnico.
  const corpo = await r.json().catch(() => null) as { pessoas?: PessoaDoQuadro[] } | null;
  if (!Array.isArray(corpo?.pessoas)) throw new Error('O Chromos não respondeu. Tente de novo em instantes.');
  return corpo.pessoas;
}

/**
 * ⚠️ Só lê se a turma já tem presença: ler um documento que não existe é
 * NEGADO pelas Rules (elas leem a unidade dele). Quem chama trata o erro como
 * "não sei o que está gravado" — nunca como lista vazia, senão salvar
 * apagaria a lista que existe (auditoria de 28/10/2026).
 */
export async function lerPresenca(turma: Pick<Treinamento, 'id' | 'presencaPelaLista'>): Promise<Participante[]> {
  if (!isFirebaseEnabled || !db || !turma.presencaPelaLista) return [];
  const s = await getDoc(doc(db, 'presencas', turma.id));
  return s.exists() ? ((s.data().participantes as Participante[]) || []) : [];
}

export async function salvarPresenca(turma: Treinamento, participantes: Participante[]): Promise<void> {
  if (!isFirebaseEnabled || !db) return;
  if (!turma.escopo) throw new Error('Turma sem unidade gravada: peça ao Administrador para editá-la antes.');
  const lote = writeBatch(db);
  lote.set(doc(db, 'presencas', turma.id), { escopo: turma.escopo, participantes, atualizadoEm: dataISOLocal() });
  lote.update(doc(db, 'treinamentos', turma.id), {
    qtdRealizada: participantes.length,
    totalHorasFormacao: participantes.length * (Number(turma.cargaHoraria) || 0),
    presencaPelaLista: true,
  });
  await lote.commit();
}

/**
 * O Administrador mudou a unidade da turma: a presença vai junto. Senão ela
 * fica na unidade antiga, e a nova não lê, não grava, nem apaga a turma
 * (o lote da exclusão é negado) — auditoria de 28/10/2026.
 */
export async function realinharPresenca(turmaId: string): Promise<void> {
  if (!isFirebaseEnabled || !db) return;
  const turma = await getDoc(doc(db, 'treinamentos', turmaId));
  const dados = turma.exists() ? turma.data() : undefined;
  if (!dados?.escopo || !dados.presencaPelaLista) return;
  const escopo = dados.escopo;
  const presenca = await getDoc(doc(db, 'presencas', turmaId));
  if (presenca.exists() && presenca.data().escopo !== escopo) await updateDoc(doc(db, 'presencas', turmaId), { escopo });
}

/** Apagar a turma leva a presença junto (nomes não ficam órfãos no banco). */
export async function apagarTurmaComPresenca(turma: Treinamento): Promise<void> {
  if (!isFirebaseEnabled || !db) return;
  const lote = writeBatch(db);
  // Só se existe: a regra de apagar lê a unidade do documento.
  if (turma.presencaPelaLista) lote.delete(doc(db, 'presencas', turma.id));
  lote.delete(doc(db, 'treinamentos', turma.id));
  await lote.commit();
}
