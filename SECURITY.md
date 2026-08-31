# Security Policy

## Supported versions

This is a portfolio demonstration project. Only the latest commit on the default branch receives fixes.

## Scope

AuditSeal builds and verifies a synthetic hash-chained audit log entirely in the browser. It does not persist production audit data, connect to external logging services, or handle real credentials.

## Reporting a vulnerability

If you find an issue where `verify()` fails to detect tampering or missing links, or where append semantics allow silent chain rewrites, contact Saeed Rumaneh via the address on their public profile with reproduction steps and expected vs observed behavior.

## Non-goals

- Do not use AuditSeal as a production audit store.
- Demo events are fictional; do not paste real incident data.
- Hash sealing here demonstrates integrity concepts; production systems should use authenticated, append-only storage with key management.
