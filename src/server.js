import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import familiasRouter from './routes/familias.js';
import tiposRouter from './routes/tipos.js';
import itensRouter from './routes/itens.js';
import movimentacoesRouter from './routes/movimentacoes.js';
import dashboardRouter from './routes/dashboard.js';
import aiRouter from './routes/ai.js';
import { getSupabaseStatus } from './config/supabase.js';
import authRouter from './routes/auth.js';
import { requireAuth, requirePageAuth } from './middleware/auth.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.resolve(__dirname, '../frontend');

app.use(cors());
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self)');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (_req, res) => {
  const database = await getSupabaseStatus();
  res.status(database.connected ? 200 : 503).json({ ok: database.connected, service: 'Almoxerifado SENAI-SP', database });
});
app.use('/api/auth', authRouter);
app.use('/api', requireAuth);
app.use('/api/familias', familiasRouter);
app.use('/api/tipos', tiposRouter);
app.use('/api/itens', itensRouter);
app.use('/api/movimentacoes', movimentacoesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/ai', aiRouter);

app.get('/login.html', (_req, res) => res.sendFile(path.join(frontendPath, 'login.html')));
app.use('/css', express.static(path.join(frontendPath, 'css')));
app.use('/js', express.static(path.join(frontendPath, 'js')));
app.get('/', requirePageAuth, (_req, res) => res.sendFile(path.join(frontendPath, 'index.html')));
app.use('/pages', requirePageAuth, express.static(path.join(frontendPath, 'pages')));

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || (err.code === '23505' ? 409 : 0)
    || (['23503', '23514', '22P02'].includes(err.code) ? 400 : 0) || 500;
  const friendly = {
    23505: 'Já existe um cadastro com esses dados.',
    23503: 'O cadastro relacionado não existe ou ainda está em uso.',
    23514: 'Um dos valores informados é inválido.',
    '22P02': 'O identificador informado é inválido.',
    PGRST202: 'As funções do banco não foram encontradas. Execute database/schema.sql no SQL Editor do Supabase.',
    '42P01': 'As tabelas do banco não foram encontradas. Execute database/schema.sql no SQL Editor do Supabase.',
  }[err.code];
  res.status(status).json({ error: friendly || err.message || 'Erro interno do servidor.' });
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  app.listen(port, () => console.log(`✅ Almoxerifado SENAI-SP em http://localhost:${port}`));
}

export default app;

