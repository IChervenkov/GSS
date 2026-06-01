# Repository Layout for GSS

```text
/docs
  /governance
/src
  /app
  /bootstrap
  /core
  /infrastructure
  /modules
    /api
      /auth
    /web
      /auth
      /base
      /main-page
      /bicycles
      /accommodation
      /assets
      /laundry
  /shared
/tests
  /unit
  /integration
  /e2e
/scripts
```

## Mapping rules

- Each feature module keeps its own `application/`, `domain/`, `infrastructure/`, and `presentation/` directories.
- Module root files are composition-only entry points such as `*.module.ts` and `*.routes.ts`.
- EJS views and browser assets should live with the owning module when they are feature-specific.
- Shared browser primitives belong under:
  - `shared/public/js/core`
  - `shared/public/css/core`
  - `shared/views/partials`

## Naming guidance for current stack

- EJS views: `verify-qr-code.ejs`, `change-password.ejs`
- Browser files: `verify-qr.page.ts`, `main-page.page.ts`
- Shared browser primitives: `toast.ts`, `fetch-json.ts`, `modal.ts`
- Route files: `auth.routes.ts`, `main.routes.ts`
- Presenter files: `auth.presenter.ts`, `main.presenter.ts`
- Use cases: `request-qr.use-case.ts`, `verify-login.use-case.ts`
- Repositories: `auth.repository.ts`
- DTOs: `request-qr-response.dto.ts`
