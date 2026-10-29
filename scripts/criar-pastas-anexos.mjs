// Uma vez só (29/10/2026): a conta `sgpc-anexos` cria as pastas do Colégio e da
// Universidade dentro do Drive compartilhado do RH, com a marca `sgpcPasta`
// que api/anexos.ts confere antes de gravar (variável trocada não vaza de uma
// unidade para a outra). Criadas pela PRÓPRIA conta, as pastas ficam ao
// alcance do escopo `drive.file` que a rota usa.
//
// Uso (quem roda precisa poder personificar a conta — roles/iam.serviceAccountTokenCreator
// nela, temporário):
//   node scripts/criar-pastas-anexos.mjs <id da pasta ou do Drive compartilhado>
// Saída: os dois ids, para DRIVE_PASTA_COLEGIO e DRIVE_PASTA_UNIVERSIDADE na Vercel.
import { execSync } from 'node:child_process';

const CONTA = 'sgpc-anexos@project-312a1a63-026e-4dfa-91c.iam.gserviceaccount.com';
const pai = process.argv[2];
if (!/^[A-Za-z0-9_-]{10,100}$/.test(pai || '')) { console.error('passe o id da pasta do Drive compartilhado'); process.exit(1); }

const token = execSync(`gcloud auth print-access-token --impersonate-service-account=${CONTA} --scopes=https://www.googleapis.com/auth/drive.file`, { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const API = 'https://www.googleapis.com/drive/v3/files';
const h = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

for (const [unidade, nome] of [['colegio', 'SGPC – Anexos do Colégio'], ['universidade', 'SGPC – Anexos da Universidade']]) {
  // Já existe? (rodar de novo não duplica)
  const q = encodeURIComponent(`appProperties has { key='sgpcPasta' and value='${unidade}' } and trashed=false`);
  const ja = await (await fetch(`${API}?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives&fields=files(id)`, { headers: h })).json();
  if (ja.files?.length) { console.log(`${unidade}: ${ja.files[0].id} (já existia)`); continue; }
  const r = await fetch(`${API}?supportsAllDrives=true&fields=id`, {
    method: 'POST', headers: h,
    body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [pai], appProperties: { sgpcPasta: unidade } }),
  });
  const j = await r.json();
  if (!r.ok) { console.error(`${unidade}: falhou (${r.status}) ${j?.error?.message || ''}`); process.exit(1); }
  console.log(`${unidade}: ${j.id}`);
}
