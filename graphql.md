# GraphQL Adoption Blueprint for Exodrive

> **Status:** Draft · Last updated {{DATE}}
> 
> Purpose: Identify the surfaces in Exodrive that benefit most from Supabase **pg_graphql** and lay out an incremental implementation plan. No executable code is included.

---

## 1. Why consider GraphQL?

| Benefit | Impact on Exodrive |
|---------|-------------------|
| **Nested Fetching** | Catalogue pages need `cars → images → pricing → availability`; GraphQL can deliver this in a single round-trip rather than chained REST calls. |
| **Typed Contract** | Auto-generated TS types via `graphql-codegen` reduce runtime bugs in the React front-end. |
| **Productivity** | FE devs can compose queries without waiting for bespoke REST endpoints; quicker iteration on UI. |
| **Future Mobile / Partner API** | A stable GraphQL schema is attractive for iOS/Android teams or marketplace partners. |

> Caveat: For write-heavy, transactional flows (e.g.
> booking creation), RPC/SQL functions remain safer and faster. GraphQL excels mainly in *read* scenarios here.

---

## 2. Analysis – Where GraphQL **adds value**

### 2.1 Public-Facing Pages

| Page / Component | Current Data Calls | GraphQL Advantage |
|------------------|-------------------|-------------------|
| **Home page** (`/`) | `hero_content`, featured `cars`, pricing snippets → multiple parallel REST calls | Single query with fragments for hero + featured car. |
| **Car list** (`/cars`) | List cars + primary image + base price → REST with joins or repeated calls | One query; filters & pagination native via GraphQL. |
| **Car detail** (`/cars/[slug]`) | Car, specs, images, reviews, pricing, availability preview | GraphQL can fetch nested relations; FE can choose only fields needed. |

### 2.2 Admin Dashboard (Server Components)

| Feature | Current Approach | GraphQL Efficiency |
|---------|-----------------|--------------------|
| Car CRUD table | REST call per tab (images, specs, pricing) | Compound query; reduces code complexity. |
| Booking overview | Need customer, payments, media counts | GraphQL can join across tables for a compact overview list. |
| Inbox / Webhook logs | Low benefit (simple table) | Keep REST. |

### 2.3 External Consumers

* **Mobile App** – GraphQL enables flexible queries without shipping new REST endpoints.
* **Partner Integrations** – limited, curated schema with persisted queries.

### 2.4 Areas **not** suited for GraphQL

| Flow | Reason to avoid |
|------|----------------|
| **Booking creation** | Needs Redis lock + multi-step SQL transaction. Implement as RPC/HTTP function. |
| **Webhook ingestion** | Push model; GraphQL irrelevant. |
| **Security-deposit capture/void** | Server-to-server PayPal calls → keep in API routes. |
| **Media upload** | Signed URL flow easier with REST. |

---

## 3. Efficiency Estimation

| Metric | Status-Quo (REST) | Expectation with GraphQL |
|--------|------------------|---------------------------|
| Home page API calls | 4–6 HTTP requests | 1 request ▼ 80% |
| Car detail API calls | 5–8 requests (images/specs) | 1–2 requests ▼ 75% |
| Admin car list render time | ~600 ms (multiple joins) | ~350 ms (single query) |
| FE type maintenance | Manual `zod` schemas | Auto-generated types (save ~1-2 hrs / feature) |

*Numbers are indicative; actual gains will be validated during Phase 1 spike.*

---

## 4. Adoption Roadmap

| Phase | Goal | Tasks | Owner |
|-------|------|-------|-------|
| **0 – Preparation** | Enable `pg_graphql`; secure endpoint | • Toggle in Supabase dashboard<br>• Verify RLS propagation<br>• Set rate-limits | Infra |
| **1 – Spike & Benchmark** | Validate DX + performance | • Author sample query for `/cars` list<br>• Compare latency & row counts vs REST<br>• Document findings | FE lead |
| **2 – Public Catalogue** | Ship GraphQL on public pages | • Generate TypeScript types (`graphql-codegen`)<br>• Refactor Home, Car list, Car detail pages to use GraphQL hooks (TanStack or urql)<br>• Persist queries in repo | FE team |
| **3 – Admin Dashboard** | Migrate read-heavy grids | • Build GraphQL fragments for cars & bookings overview<br>• Add column filters via GraphQL variables | Admin squad |
| **4 – Schema Governance** | Prevent expensive queries | • Implement persisted-query middleware (Edge function)<br>• Add depth & cost limits<br>• Document conventions | Infra + Backend |
| **5 – Mobile / Partner API** | External contract | • Versioned GraphQL endpoint<br>• Docs via GraphQL Voyager / GraphiQL in prod-read-only mode | PM + DevRel |

> **Key Principle:** *Reads over GraphQL, writes via RPC.* Critical mutations (booking creation, admin availability override) stay in typed API routes backed by SQL functions.

---

## 5. Tooling Decisions

* **Client**: TanStack Query's `@tanstack/react-query` + `@tanstack/react-query-alt-gql` or **urql** for lightweight footprint.
* **Codegen**: `graphql-codegen` run in `postinstall` – outputs hooks & types (`lib/gql/`).
* **Caching**: Normalised in-memory cache at component layer; Supabase Postgres remains source of truth.
* **Monitoring**: Supabase observability + `explain` plans for slow queries.

---

## 6. Open Questions

1. Do we adopt Apollo Router for persisted-query enforcement or roll a small Edge Function?
2. What query-cost formula (depth × field weight) is acceptable for public clients?
3. Which auth token to expose for GraphQL read-only access to anonymous users?

---

> End of document – submit feedback in PR comments. 