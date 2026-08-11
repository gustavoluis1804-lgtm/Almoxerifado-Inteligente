# 📦 Almoxerifado Inteligente SENAI-SP

Sistema Fullstack de controle de estoque e Arquivo Morto via QR Code.

## Stack
- Frontend: HTML5, Tailwind CSS (CDN), CSS3, JavaScript Vanilla
- Backend: Node.js + Express.js
- Banco: Supabase/PostgreSQL
- QR Code: html5-qrcode + qrcode
- IA: Google Gemini via `@google/genai`

## 1. Banco de dados
No Supabase, abra o **SQL Editor** e execute `database/schema.sql`.

O arquivo precisa ser executado no mesmo projeto indicado por `SUPABASE_URL`. Ele cria as tabelas, as funções de movimentação e os dados iniciais. Para conferir a conexão, com o backend ligado acesse `http://localhost:3000/api/health`: `connected: true` confirma a conexão e `empty: true` indica que o schema/dados iniciais ainda não foram aplicados nesse projeto.

O mesmo SQL também cria o bucket público `item-images` e a coluna `imagem_url`. As fotos selecionadas no cadastro são redimensionadas para no máximo 1200 × 1200, convertidas para WebP e limitadas a 1,5 MB antes do envio ao Supabase Storage.

## 2. Backend
```bash
cd backend
npm install
```
Copie `.env.example` para `.env` e preencha:
```env
PORT=3000
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SECRET_KEY=sua-chave-server-side
GEMINI_API_KEY=sua-chave-gemini
GEMINI_MODEL=gemini-3.5-flash
```
> Nunca coloque `SUPABASE_SECRET_KEY` ou `GEMINI_API_KEY` no frontend/GitHub.

Inicie:
```bash
npm start
```
Abra: `http://localhost:3000`

## Publicação na Vercel

O projeto inclui `vercel.json` e uma entrada serverless em `api/index.js`. Na Vercel, configure as variáveis `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `GEMINI_API_KEY` e `GEMINI_MODEL`. Nunca envie o arquivo `backend/.env` ao GitHub.

## Login

O sistema usa o Supabase Auth. No painel do Supabase, acesse **Authentication → Users → Add user** e crie o e-mail e a senha do administrador. Ao abrir o sistema, as páginas e APIs protegidas redirecionam para `login.html`.

## Fluxo principal
1. Cadastre famílias e tipos.
2. Cadastre um item.
3. O banco gera o SKU `FFF.TTT.PPPP` automaticamente.
4. O backend gera o QR Code.
5. No celular, abra a tela de scanner.
6. Escaneie o QR e registre Entrada ou Saída.
7. O saldo e o histórico são atualizados de forma atômica no Supabase.
8. Use o Assistente IA para consultar os dados do estoque.

## Observação sobre câmera
Navegadores normalmente exigem **HTTPS ou localhost** para liberar a câmera. Ao testar em outro celular na rede, publique temporariamente o sistema em um host HTTPS ou use uma solução de túnel/hosting aprovada pelo professor.

## Estrutura
```text
almoxerifado-senai/
├── backend/
├── database/schema.sql
├── frontend/
└── README.md
```
