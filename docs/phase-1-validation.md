# Validación FASE 1

Comandos obligatorios antes de cerrar la fase:

```bash
npm run lint
npm run build
npm run test
```

Checklist:

- La app redirige `/` a `/dashboard`.
- Usuarios no autenticados van a `/login`.
- Magic link vuelve a `/auth/callback`.
- Usuarios autenticados sin organización ven la creación de workspace.
- Usuarios con membresía ven métricas filtradas por `organization_id`.
- Las tablas operativas tienen RLS habilitado y políticas tenant.
