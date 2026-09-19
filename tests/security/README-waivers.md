# Accepted risks (deliberately not tested)

| Finding | Decision | Date |
|---|---|---|
| `admin` / `admin` seeded on an empty database (server/main.ts) | Accepted by the project owner. No test asserts against it; the security suite uses this pair as its fixture credential. | 2026-09-19 |

If the decision changes, the test is three lines: log in over DDP with the pair
and assert an error comes back.
