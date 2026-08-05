# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a Kubernetes learning repository containing practical labs and examples for mastering Kubernetes concepts. The primary focus is `laboratorio_01`, a hands-on full-stack application (React + Go) deployed on Minikube in WSL2, with additional foundational examples for core K8s resources.

### Directory Structure

- **`laboratorio_01/`** — Main comprehensive lab: full-stack application with React frontend + Go backend, complete with detailed documentation and troubleshooting guide
  - `backend/` — Go HTTP API server, Dockerfile, and Deployment manifest
  - `frontend/` — React/Vite SPA with Nginx reverse proxy, Dockerfile, and Deployment manifest
  - `README.md` — Step-by-step deployment guide for Minikube
  - `FALLOS.md` — Detailed troubleshooting log of 7 common issues and their solutions
- **`pods/`, `replicaset/`, `deployment/`, `services/`** — Basic Kubernetes resource examples (minimal manifests for learning)
- **`namespaces/`** — Namespace isolation examples (prod, uat, lab-namespaces with a Node.js app)
- **`limit-range/`, `limit-request/`** — Resource quota and limit examples

## Key Architecture & Patterns

### laboratorio_01: Full-Stack Deployment Pattern

The lab demonstrates a **multi-tier Kubernetes architecture** with service-to-service communication:

```
Browser (Windows) → port-forward 8888:80
  ↓
[frontend-service] NodePort :30080 / ClusterIP :80
  ↓ (Nginx proxy)
[frontend] Nginx :80 → proxy_pass /api/ to backend-service:8080
  ↓
[backend-service] ClusterIP :8080
  ↓
[backend] Go HTTP :8080
```

**Critical patterns:**
- Multi-stage Dockerfiles (builder → runtime) minimize image size
- ClusterIP for internal service-to-service communication (backend)
- NodePort for external access (frontend); doesn't work directly on WSL2/Windows
- Nginx reverse proxy handles `/api/` routing to backend
- Readiness and liveness probes on all containers
- Resource requests/limits defined (CPU: 50-200m, Memory: 32-128Mi)

### WSL2 + Minikube Gotchas

This environment has specific networking constraints that affect deployment:

1. **Docker daemon isolation**: Minikube runs its own Docker daemon (separate from host). Images built on the host are **not** visible to pods. Always build with `eval $(minikube docker-env)`.

2. **ClusterIP routing**: ClusterIP is only accessible from **within the cluster**. External access requires `kubectl port-forward`.

3. **NodePort double NAT**: Minikube's NodePort (e.g., `192.168.49.2:30080`) is unreachable from Windows due to WSL2 + Minikube layered virtualization. Solution: use `kubectl port-forward service/frontend-service 8888:80` from WSL2 (localhost ports forward to Windows).

4. **Nginx + Go path handling**: When using Nginx to proxy requests to Go, both the location and proxy_pass must handle trailing slashes consistently. Mismatched slashes cause Go to issue 301 redirects or create double-slash paths. See `FALLOS.md` for the exact fix.

## Development Commands

### Prerequisites

```bash
minikube start                    # Start Minikube cluster
eval $(minikube docker-env)       # Point Docker to Minikube's daemon
```

### Building & Deploying laboratorio_01

```bash
# Build images inside Minikube's Docker daemon
eval $(minikube docker-env)
docker build -t backend:latest ./laboratorio_01/backend
docker build -t frontend:latest ./laboratorio_01/frontend
eval $(minikube docker-env --unset)

# Apply manifests
kubectl apply -f laboratorio_01/backend/deployment.yaml
kubectl apply -f laboratorio_01/frontend/deployment.yaml

# Verify pods are running
kubectl get pods
```

### Testing & Debugging

```bash
# Watch pod status
kubectl get pods -w

# View logs from all backend pods
kubectl logs -f -l app=backend

# View logs from a specific pod
kubectl logs -f <pod-name>

# Execute command inside a pod (e.g., test Nginx config)
kubectl exec $(kubectl get pod -l app=frontend -o name | head -1) -- cat /etc/nginx/conf.d/default.conf

# Test backend connectivity from frontend pod
kubectl exec $(kubectl get pod -l app=frontend -o name | head -1) -- wget -qO- http://backend-service:8080

# Expose ClusterIP service locally (for testing)
kubectl port-forward service/backend-service 9090:8080 &
curl http://localhost:9090
```

### Accessing the Application

```bash
# Forward frontend to localhost (from WSL2)
kubectl port-forward service/frontend-service 8888:80

# In Windows browser: http://localhost:8888
```

### Rebuilding After Code Changes

```bash
# Rebuild image without cache (to pick up changes)
eval $(minikube docker-env)
docker build --no-cache -t frontend:latest ./laboratorio_01/frontend
eval $(minikube docker-env --unset)

# Restart the deployment to pick up new image
kubectl rollout restart deployment/frontend

# Watch rollout progress
kubectl rollout status deployment/frontend
```

### Cleanup

```bash
kubectl delete -f laboratorio_01/backend/deployment.yaml
kubectl delete -f laboratorio_01/frontend/deployment.yaml
```

## Deployed Services and Endpoints

### laboratorio_01

| Component | Service Name | Type | Port | Internal Endpoint | Notes |
|---|---|---|---|---|---|
| Frontend | `frontend-service` | NodePort | 30080 (node), 80 (pod) | N/A from Windows; use port-forward | Nginx serving React SPA |
| Backend | `backend-service` | ClusterIP | 8080 | Only from inside cluster | Go JSON API |

## Common Issues & Solutions

See `laboratorio_01/FALLOS.md` for detailed troubleshooting of:
1. `npm ci` vs `npm install` in Dockerfile
2. Docker image isolation in Minikube (`ErrImagePull`)
3. ClusterIP unreachable from host
4. NodePort not accessible from Windows
5. Docker cache invalidation issues
6. Nginx redirect losing port number
7. Go 301 redirects on double-slash paths

**Quick diagnostic command:**
```bash
kubectl describe pod <pod-name>    # Shows events, status, resource allocation
kubectl get events                  # Cluster-wide events
```

## Testing Strategy

- **Unit level**: Backend Go code can be tested locally with standard Go tooling before containerizing
- **Integration level**: Frontend React code builds and lints with `npm run build` and `npm run lint` before Docker build
- **System level**: Full end-to-end testing requires the entire stack running in Minikube (fetch from frontend → Nginx proxy → backend API)

## Notes on Project Style

- **Manifests**: Use YAML format (`.yaml` or `.yml`), keep them declarative and minimal
- **Dockerfiles**: Multi-stage builds preferred to minimize final image size
- **Nginx config**: When proxying, ensure trailing slashes are consistent between location and proxy_pass to avoid redirect loops
- **Go server**: Uses standard library `net/http`, no framework dependencies
- **Frontend**: React 18 + Vite for development, Nginx for production serving
