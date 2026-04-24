# Mission Tracker

Application web de suivi des missions consultants IT en regie.

## Prerequis

- Node.js 20+
- npm
- Projet Supabase configure

## Installation locale

```bash
npm install
```

Creer `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://klafswwraapsaqgzbdhh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
RESEND_API_KEY=
```

Lancer en local :

```bash
npm run dev
```

## Migrations Supabase a executer

Verifier que toutes les migrations de `supabase/migrations/` sont appliquees, y compris :

- `20260424123000_add_client_operational_contact.sql`
- `20260424130000_add_admin_notifications.sql`
- `20260424143000_add_consultant_last_edited_at.sql`

## Build de verification

```bash
npm run lint
npm run build
```

## Deploiement Vercel

1. Importer le repo sur Vercel.
2. Framework detecte: **Next.js**.
3. Ajouter les variables d'environnement (Production + Preview) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (URL du domaine Vercel, ex: `https://mission-tracker.vercel.app`)
   - `RESEND_API_KEY` (optionnel, pour envoi reel des emails)
4. Deploy.
5. Verifier apres deploiement :
   - login admin,
   - creation mission + CR,
   - lien consultant `/validate/[token]` (edition + validation),
   - envoi client,
   - export PDF,
   - dashboard alertes.

## Notes securite

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` cote client.
- La cle reste uniquement cote serveur (actions/routes API).
