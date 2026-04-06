# send-email (optional)

Tenant/org email sending is implemented on the **Node server** as `POST /api/email/send` in [`server.js`](../../server.js) (Resend + JWT + org membership). The dashboard calls that route on the same origin as the app (e.g. `https://landlordapp.io`).

You do **not** need this Edge Function if you host the Express app. Add a Supabase Edge Function here only if you serve the static UI from somewhere that cannot reach your Node API and want `https://<project>.supabase.co/functions/v1/send-email` instead—in that case, duplicate the Resend + membership logic from `server.js` in Deno.
