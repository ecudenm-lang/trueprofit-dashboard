# Deploy del dashboard embebido (Vercel, sin compilar en local)

Tu disco C: está lleno, así que **no compilamos en local**: Vercel construye en la nube.

## 1. Sube el código a GitHub
Crea un repo (privado) y sube la carpeta `app-dashboard`:
```bash
cd app-dashboard
git init && git add . && git commit -m "TrueProfit dashboard embebido"
gh repo create trueprofit-dashboard --private --source=. --push
```
(o usa la web de GitHub para subirlo).

## 2. Crea el proyecto en Vercel
1. Entra a https://vercel.com → **Add New → Project** → importa el repo.
2. Framework: **Remix** (lo detecta solo).
3. En **Environment Variables** pega las de `.env.example` con tus valores reales
   (necesitas el **DB password** de Supabase → Project Settings → Database).
4. **Deploy**. Te da una URL `https://trueprofit-dashboard.vercel.app`.

## 3. Migra la tabla de sesión (Prisma) a Supabase
Una sola vez, para crear la tabla `Session`. Como C: está lleno, hazlo desde el
**SQL Editor de Supabase** con este SQL equivalente al modelo Prisma:

```sql
create table if not exists "Session" (
  "id" text primary key,
  "shop" text not null,
  "state" text not null,
  "isOnline" boolean not null default false,
  "scope" text,
  "expires" timestamptz,
  "accessToken" text not null,
  "userId" bigint,
  "firstName" text,
  "lastName" text,
  "email" text,
  "accountOwner" boolean not null default false,
  "locale" text,
  "collaborator" boolean default false,
  "emailVerified" boolean default false,
  "refreshToken" text,
  "refreshTokenExpires" timestamptz
);
```

## 4. Configura la Partner app para embeber
En https://partners.shopify.com → tu app → **Configuration**:
- **App URL**: `https://trueprofit-dashboard.vercel.app`
- **Allowed redirection URL(s)**:
  - `https://trueprofit-dashboard.vercel.app/auth/callback`
  - `https://trueprofit-dashboard.vercel.app/auth/shopify/callback`
  - `https://trueprofit-dashboard.vercel.app/api/auth/callback`
- **Embedded app**: activado.
- Scopes: `read_products,read_orders,read_inventory`.

## 5. Instala en tu tienda
Abre `https://trueprofit-dashboard.vercel.app/auth?shop=581g0i-ru.myshopify.com`
o instala desde el Partner Dashboard. Al abrir la app en el Admin verás el P&L.

---
## ⚠️ Urgente aparte del proyecto
Tu disco **C: está al 100% (0 bytes libres)**. Conviene liberar espacio pronto
(Windows y apps fallan sin espacio): Configuración → Sistema → Almacenamiento,
o mover el caché de npm a D: con `npm config set cache D:/npm-cache`.
