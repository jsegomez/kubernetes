# Laboratorio Kubernetes 01

Laboratorio práctico de despliegue de una aplicación full-stack (React + Go) en Kubernetes usando Minikube en WSL2.

## Arquitectura

```
Internet / Navegador (Windows)
        │
        │ localhost:8888  (kubectl port-forward)
        │
  [frontend-service]  NodePort :30080 / ClusterIP :80
        │
  [Pod Frontend]  Nginx :80
        │  proxy_pass /api/ → backend-service:8080
        │
  [backend-service]  ClusterIP :8080
        │
  [Pod Backend]  Go HTTP :8080
```

### Componentes

| Componente | Tecnología | Puerto |
|---|---|---|
| Frontend | React 18 + Vite + Nginx | 80 (contenedor) |
| Backend | Go net/http | 8080 (contenedor) |
| Orquestación | Kubernetes (Minikube) | — |

---

## Estructura del proyecto

```
laboratorio_01/
├── backend/
│   ├── src/
│   │   └── main.go          # Servidor HTTP Go — responde JSON en /
│   ├── Dockerfile           # Multi-stage: builder golang → alpine
│   └── deployment.yaml      # Deployment + Service ClusterIP :8080
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx          # Componente principal — consume el backend
│   │   ├── App.css
│   │   └── index.css
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── nginx.conf           # Proxy /api/ → backend-service:8080
│   ├── Dockerfile           # Multi-stage: node build → nginx serve
│   ├── .dockerignore
│   └── deployment.yaml      # Deployment + Service NodePort :30080
└── README.md
```

---

## Backend

API REST mínima en Go que devuelve un mensaje y la fecha/hora actual.

**Endpoint:** `GET /`

```json
{
  "mensaje": "Hola Mundo",
  "fecha_hora": "2026-05-30 10:00:00"
}
```

### Dockerfile — backend

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY src/ .
RUN go mod init backend && go build -o server main.go

FROM alpine:3.19
WORKDIR /app
COPY --from=builder /app/server .
EXPOSE 8080
CMD ["./server"]
```

### Kubernetes — backend

- **Deployment:** 2 réplicas, `imagePullPolicy: IfNotPresent`
- **Service:** `ClusterIP` en puerto `8080` — solo accesible dentro del clúster
- Liveness y readiness probes sobre `GET /`

---

## Frontend

SPA React que consulta el backend cada 10 segundos y muestra el estado del servicio en tiempo real.

### Flujo de la llamada API

| Contexto | URL que usa React | A dónde va |
|---|---|---|
| Dev (`npm run dev`) | `/api/` | proxy Vite → `localhost:8080` |
| Producción (Docker/K8s) | `/api/` | proxy Nginx → `backend-service:8080` |

### Nginx (`nginx.conf`)

```nginx
location /api/ {
    proxy_pass http://backend-service:8080/;
}

location / {
    try_files $uri $uri/ /index.html;   # SPA fallback
}
```

> **Importante:** tanto la location como el fetch deben usar `/api/` con trailing slash.
> Sin él, Nginx genera un redirect 301 y Go redirige paths con doble slash, rompiendo la cadena.

### Dockerfile — frontend

```dockerfile
# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Kubernetes — frontend

- **Deployment:** 2 réplicas, `imagePullPolicy: IfNotPresent`
- **Service:** `NodePort` en puerto `30080`
- Liveness y readiness probes sobre `GET /`

---

## Despliegue paso a paso

### Requisitos

- Minikube instalado y corriendo (`minikube start`)
- Docker disponible
- kubectl configurado

### 1. Construir las imágenes dentro de Minikube

Siempre construir apuntando al daemon de Docker de Minikube para que los pods puedan usar las imágenes locales:

```bash
eval $(minikube docker-env)

docker build -t backend:latest ./backend
docker build -t frontend:latest ./frontend

eval $(minikube docker-env --unset)
```

> Si se usa `docker build` en el host sin apuntar al daemon de Minikube, los pods no encuentran
> las imágenes y quedan en estado `ErrImagePull` o `ImagePullBackOff`.

### 2. Aplicar los manifiestos

```bash
kubectl apply -f backend/deployment.yaml
kubectl apply -f frontend/deployment.yaml
```

### 3. Verificar que los pods estén corriendo

```bash
kubectl get pods
```

Salida esperada:

```
NAME                        READY   STATUS    RESTARTS   AGE
backend-xxx                 1/1     Running   0          1m
backend-yyy                 1/1     Running   0          1m
frontend-xxx                1/1     Running   0          1m
frontend-yyy                1/1     Running   0          1m
```

### 4. Exponer el frontend hacia Windows (WSL2)

El NodePort de Minikube no es directamente alcanzable desde Windows en WSL2 por doble NAT.
Usar `port-forward` sobre `localhost`, que WSL2 sí reenvía automáticamente a Windows:

```bash
kubectl port-forward service/frontend-service 8888:80
```

Abrir en el navegador de Windows:

```
http://localhost:8888
```

---

## Comandos útiles

### Verificar estado general

```bash
kubectl get pods
kubectl get services
kubectl get endpoints
```

### Ver logs

```bash
# Logs de todos los pods del frontend
kubectl logs -f -l app=frontend

# Logs de todos los pods del backend
kubectl logs -f -l app=backend
```

### Probar el backend desde WSL

El ClusterIP no es accesible desde fuera del clúster. Usar port-forward:

```bash
kubectl port-forward service/backend-service 9090:8080 &
curl http://localhost:9090
```

### Verificar configuración dentro de un pod

```bash
# Ver nginx.conf activo en el pod
kubectl exec $(kubectl get pod -l app=frontend -o name | head -1) -- cat /etc/nginx/conf.d/default.conf

# Probar conectividad al backend desde el pod del frontend
kubectl exec $(kubectl get pod -l app=frontend -o name | head -1) -- wget -qO- http://backend-service:8080
```

### Reconstruir y redesplegar tras cambios

```bash
eval $(minikube docker-env)
docker build --no-cache -t frontend:latest ./frontend
eval $(minikube docker-env --unset)
kubectl rollout restart deployment/frontend
```

---

## Notas sobre el entorno WSL2 + Minikube

- Las imágenes Docker del host **no son visibles** en Minikube. Siempre construir con `eval $(minikube docker-env)`.
- El ClusterIP **solo es accesible desde dentro del clúster**. Usar `port-forward` para pruebas locales.
- El NodePort de Minikube (`192.168.49.x:30080`) **no es alcanzable desde Windows** por el doble NAT de WSL2. Usar `port-forward` sobre `localhost`.
- WSL2 reenvía automáticamente los puertos de `localhost` a Windows, por eso `port-forward` sí funciona.
