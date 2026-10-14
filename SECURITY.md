# Security

- Do not store Realm credentials or app-owned bearer credentials in this repository.
- Perform admitted SDK operations through the host-bound client injected by the Nimi Desktop supervised session; do not use `createNimiClient` with arbitrary credentials to connect directly to Runtime or Realm.
- Treat the App Access domain declaration as registration input, never as operation authority.
