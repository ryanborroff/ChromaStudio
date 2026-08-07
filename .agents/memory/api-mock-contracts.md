---
name: API mock contracts
description: Demo-mode MSW handlers must mirror the generated client and OpenAPI response shapes.
---

Demo-mode MSW handlers are part of the frontend’s API contract and must return the same envelope and field names as the generated client/OpenAPI responses.

**Why:** A storage/security page crashed when stale mock responses used legacy field names and an object envelope where the client expected an array.

**How to apply:** When an API response schema changes, update its MSW handler in the same change and verify the affected route through the browser.