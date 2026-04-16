# Jazure Automation

Agent-first CLI tooling for deploying + managing apps on James's Jazure cluster (Talos k8s + Kubero + Woodpecker + Cloudflare for SaaS portal). No UI clicking.

## Motivation

James built an impressive homelab PaaS (5-node Talos k8s, Kubero, Woodpecker CI, Cloudflare tunnel, self-serve custom domain portal). All three layers expose REST APIs. Driving them from CLI / Claude agent is strictly faster than clicking through dashboards.

## Stack touch-points

| Service | URL | API |
|---|---|---|
| Kubero | kubero.jazure.net | `/api/auth/login` (JWT), `/api/pipelines/{name}`, `/api/apps/{pipeline}/{phase}/{app}`, OpenAPI at `/api/docs-json` |
| Woodpecker | woodpecker.jazure.net | `/api/user/repos`, `/api/repos/{o}/{r}/secrets`, bearer token auth |
| Portal | portal.jazure.net | `POST /api/domains` (Cloudflare for SaaS hostname registration) |
| GHCR | ghcr.io | `docker login` + `gh` for PATs |

## Deliverables

- [ ] `~/scripts/jazure/` — CLI toolkit
  - [ ] `jazure login` — store Kubero JWT + Woodpecker token in keychain
  - [ ] `jazure deploy <repo>` — end-to-end: scaffold Dockerfile + `.woodpecker.yaml`, create Kubero pipeline + app, register Woodpecker repo + secrets, register custom hostname via portal, push
  - [ ] `jazure restart <pipeline>/<phase>/<app>`
  - [ ] `jazure logs <pipeline>/<phase>/<app>`
  - [ ] `jazure domains add <hostname>`
- [ ] Portfolio4 as first deploy (validates the flow)
- [ ] Document API quirks discovered along the way
- [ ] Map out what OTHER services James runs on Jazure worth integrating

## Credentials

- **SSH**: `ssh meesh@jazure.net` (key-based auth, already set up)
- **sudo password** (`meesh` user): `ZupFt1qjrejQOjgnNHRTAL6G` (rotated 2026-04-12)
- **Kubeconfig (cluster)**: `/home/james/workspaces/cluster/setup/kubeconfig` (requires sudo to read)
- **Talosconfig**: `/home/james/workspaces/cluster/setup/talosconfig` (requires sudo)
- **Kubero login**: username `chase` / password `Test123` (verified 2026-04-12, JWT ~513 chars via `/api/auth/login`). JWT expires; re-issue on each script run.
- **Woodpecker PAT**: stored at `~/.config/jazure/woodpecker-token` (0600), created 2026-04-12. **Long-lived** — authenticates ALL future Woodpecker API calls (register repos, add secrets, trigger builds). If rotated, update that file. Verified: `curl -H "Authorization: Bearer $(cat ~/.config/jazure/woodpecker-token)" https://woodpecker.jazure.net/api/user` → returns MC-Meesh.

> Storing in plain markdown for now per explicit decision (2026-04-12). Migrate to 1Password/Bitwarden + env var loader once the PaaS is handling something meaningful.

## Access & caution policy

**Tested 2026-04-12 via `ssh meesh@jazure.net`:**

| Check | Result |
|---|---|
| `meesh` in sudo group | ✅ `groups` → `meesh sudo users docker` |
| sudo with password | ✅ `Secure123` works (James set it 2026-04-12) |
| `kubectl` installed | ✅ `/snap/bin/kubectl` v1.34.6 |
| `talosctl` installed | ✅ `/usr/local/bin/talosctl` |
| `helm` installed | ✅ `/usr/local/bin/helm` |
| Docker group | ✅ can run docker without sudo |
| Kubeconfig located | ✅ `/home/james/workspaces/cluster/setup/kubeconfig` |
| Talosconfig located | ✅ `/home/james/workspaces/cluster/setup/talosconfig` |
| Cluster reachable | ✅ `kubectl get nodes` → all 5 nodes Ready (node1-5, k8s v1.34.1, 124d uptime) |

**Agents CAN sudo non-interactively** via `echo "Secure123" \| sudo -S <cmd>`. Password stored in 1Password/Bitwarden; change as needed via `passwd` over ssh.

### Invocation patterns
```bash
# Run kubectl as root with James's kubeconfig (read-only work)
ssh meesh@jazure.net 'echo "Secure123" | sudo -S KUBECONFIG=/home/james/workspaces/cluster/setup/kubeconfig kubectl <args>'

# Optional: stage a copy to meesh-readable location (ONE-TIME, requires Chase/James approval)
# sudo cp /home/james/workspaces/cluster/setup/kubeconfig /home/meesh/.kube/config
# sudo chown meesh:meesh /home/meesh/.kube/config
# Then subsequent calls don't need sudo/env var
```

**Policy: read-only exploration only, no mutations without explicit James sign-off.**

- `kubectl get`, `logs`, `describe` — fine for debugging our own apps, once kubeconfig is accessible
- `kubectl apply`, `delete`, `patch`, `exec -it` — **DO NOT** run against anything we don't own
- Never touch `talosctl` without James on the line
- Prefer the Kubero/Woodpecker/portal APIs (PaaS layer) — they're the intended interface and are namespace-scoped to what we deploy
- If something requires cluster-admin, file it as a "needs James" note here and ping him

Rationale: cluster is shared infra running his production apps (landlordfriend.com, scaler.to, etc.). A bad apply or a stuck finalizer could take down his business. The PaaS exists so we don't need cluster access — use that path by default.

## Security hardening backlog

The `ghcr_token` PAT is our biggest single-point-of-compromise. Current plan (Option A below) is pragmatic but not ideal long-term.

### Options (current → ideal)

**A. Classic PAT, short-lived + Woodpecker-only storage** — CURRENT CHOICE
- 90-day expiry, `write:packages` scope only, stored ONLY in Woodpecker user secret (never on local disk, never in wiki)
- Covers all MC-Meesh GHCR repos with one token
- Leak blast radius: anyone could push malicious images to any of your packages until the expiry or manual revoke
- Rotation: calendar reminder every 90 days, regen + update Woodpecker user secret

**B. Fine-grained PAT per repo**
- One token per repo with `Contents:read` + `Packages:write` for that repo only
- Leak blast radius: one repo compromised
- Cost: 60 seconds of browser work per new app

**C. GitHub App "Jazure Deployer"** ← TARGET
- Custom GitHub App owned by MC-Meesh, install per-repo with granular consent
- Woodpecker gets installation tokens that auto-refresh hourly
- Leak blast radius: 1 hour window, limited to installed repos, instantly revocable via uninstall
- Cost: 1-2 hrs to build a mint-token service + Woodpecker integration
- Worth it once we have >3 deployed apps or >1 person sharing the stack

**D. OIDC** (gold standard)
- Woodpecker 3.x mints OIDC token per build → GHCR trusts issuer → short-lived registry token
- Zero stored secrets, each build gets ephemeral credential
- Requires James to enable Woodpecker OIDC + trust config on GHCR side
- Open question: is this possible with Jazure's current Woodpecker config?

### Action items
- [ ] Set 90-day calendar reminder to rotate `ghcr_token`
- [ ] Ask James if Woodpecker OIDC → GHCR is viable on his setup
- [ ] Build "Jazure Deployer" GitHub App once we have 3+ deployed repos

## Progress / notes

- 2026-04-12: James added chase as collaborator on his kubero fork (`jamessprow/kubero`)
- 2026-04-12: James resetting jazure sudo password so agents can use it non-interactively

## Open questions for James

- Kubero user account for chase / token for API automation
- Woodpecker API token for repo registration
- Is there a public-facing LDAP/SSO or just local accounts?
- Are `jazure.net` subdomains auto-provisioned via Traefik ingress when we create a Kubero app with `domain: foo.jazure.net`, or do we need to add something at the Cloudflare zone level?

## Kubero API cheat sheet

```bash
# Login
JWT=$(curl -sf https://kubero.jazure.net/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"...","password":"..."}' | jq -r .access_token)

# Create pipeline
curl -sf -X POST https://kubero.jazure.net/api/pipelines/portfolio \
  -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' \
  -d '{
    "pipelineName":"portfolio",
    "domain":"jazure.net",
    "reviewapps":false,
    "phases":[{"name":"production","enabled":true}],
    "buildstrategy":"dockerfile",
    "deploymentstrategy":"git",
    "git":{"repository":{"ssh_url":"git@github.com:MC-Meesh/Portfolio4.git"}},
    "registry":{"host":"ghcr.io"}
  }'

# Create app
curl -sf -X POST "https://kubero.jazure.net/api/apps/portfolio/production/portfolio" \
  -H "Authorization: Bearer $JWT" \
  -H 'content-type: application/json' \
  -d '{
    "name":"portfolio",
    "image":{"repository":"ghcr.io/mc-meesh/portfolio4","tag":"latest","pullPolicy":"Always"},
    "web":{"replicaCount":1},
    "domain":"portfolio.jazure.net"
  }'

# Trigger restart
curl -sf -H "Authorization: Bearer $JWT" \
  https://kubero.jazure.net/api/apps/portfolio/production/portfolio/restart
```

## Next

Start with Portfolio4, extract reusable bits into `~/scripts/jazure/` as we go. Every time we hit an API quirk, document it here.
