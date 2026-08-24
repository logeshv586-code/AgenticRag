# Security Policy

## Secret handling

OmniRAG provider credentials are runtime secrets. They must be supplied through environment variables, an approved deployment secret store, or a single in-memory request. Real API keys, tokens, private keys, service-account credentials, passwords, and connection strings must never be committed to this repository, examples, tests, screenshots, logs, generated artifacts, or documentation.

Supported environment variable names include `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `NVIDIA_API_KEY`, and `QDRANT_API_KEY`. `.env.example` contains names only; the real `.env` is ignored by Git.

The backend must not persist request credentials in deployment metadata. Provider keys should be read only when a provider request is executed and should never be returned to the browser, logs, analytics, exported packages, or RAG metadata.

## Exposed-secret incident procedure

Treat every secret that reached Git history as compromised even when the file is later deleted.

1. Revoke the exposed credential at the provider immediately.
2. Create a new credential only after revocation; do not reuse the exposed value.
3. Store the replacement in the deployment environment or secret manager, never in source control.
4. Remove the exposed value from the current tree and identify every reachable commit, tag, and branch containing it.
5. Rewrite affected Git history when the secret remains reachable, then force-push the cleaned refs in a coordinated maintenance window.
6. Re-scan the cleaned repository and review provider usage/audit logs for unauthorized activity from the first exposure until revocation.
7. Rotate any other credential that was stored beside the exposed value or could have been read by the same leaked environment file.

Deleting a file or adding it to `.gitignore` does **not** invalidate a key and does **not** remove it from prior commits.

## Pull-request requirements

Security-sensitive changes must pass the repository security contracts. CI rejects common committed provider-token formats and tracked secret files. Never bypass those checks with a real token disguised as test data.

## Reporting

Do not open a public issue containing a credential or exploit secret. Report privately to the repository owner with the affected path/commit and a redacted identifier only.
