# Guia de deploy no Render — NutriFlow

© Ivan Mbalame

## Pré-requisitos

1. Conta [Supabase](https://supabase.com) (PostgreSQL + Auth)
2. Conta [Render](https://render.com)
3. Repositório Git com este código (GitHub/GitLab)

## 1. Supabase

1. Criar projecto.
2. SQL Editor → executar por ordem:
   - `scripts/001_create_tables.sql`
   - `scripts/002_backend_hardening.sql`
   - `scripts/003_templates_module.sql`
   - `scripts/004_multi_role_payments.sql`
3. Authentication → Providers → Email activado.
4. Authentication → URL Configuration:
   - Site URL: `https://SEU-SERVICO.onrender.com`
   - Redirect URLs: `https://SEU-SERVICO.onrender.com/**`
5. Settings → API: copiar `URL`, `anon key`, `service_role key`.

## 2. Super Admin inicial

Após criar um user no Auth (Dashboard → Authentication → Users → Add user):

```sql
update public.profiles
set role = 'super_admin', full_name = 'Ivan Mbalame', is_active = true
where email = 'admin@exemplo.com';
```

## 3. Render Web Service

1. New → Web Service → ligar o repositório.
2. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `npm start`
   - **Node Version:** 20
3. Environment Variables:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (secreto) |
| `NEXT_PUBLIC_SITE_URL` | `https://SEU-SERVICO.onrender.com` |
| `OPENAI_API_KEY` | (opcional) |

4. Deploy.

## 4. Pós-deploy

1. Login Super Admin → `/admin` → cadastrar nutricionistas (com número M-Pesa e instruções).
2. Clientes registam-se em `/register` ou são criados no admin.
3. Nutricionista: garantir `payment_phone` e `payment_instructions` no perfil (editável no admin).

## Ligar paciente ao cliente (planos PDF)

```sql
update public.patients
set client_user_id = '<uuid-do-cliente>'
where id = '<uuid-do-paciente>';
```

Assim o cliente vê os diet_plans em `/cliente/planos`.

## Troubleshooting

- **Build OOM no free tier:** use plano pago ou `NODE_OPTIONS=--max-old-space-size=4096`.
- **Auth redirect:** confirme Site URL e Redirect URLs no Supabase.
- **Admin não cria users:** `SUPABASE_SERVICE_ROLE_KEY` em falta ou inválida.
- **RLS:** políticas em `004_multi_role_payments.sql` devem estar aplicadas.
