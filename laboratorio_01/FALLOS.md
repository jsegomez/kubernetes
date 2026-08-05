# Fallos encontrados durante el laboratorio

Registro de todos los problemas encontrados, su causa raíz y cómo se resolvieron.

---

## Fallo 1 — `npm ci` falla sin `package-lock.json`

**Síntoma:**
```
npm error code EUSAGE
npm error The `npm ci` command can only install with an existing package-lock.json
```

**Causa:**
`npm ci` requiere un `package-lock.json` previo. Como Node.js no estaba disponible en WSL2
y el proyecto se creó manualmente, ese archivo nunca existió.

**Fix:** cambiar en el `Dockerfile` del frontend:
```dockerfile
# Antes
RUN npm ci

# Después
RUN npm install
```

---

## Fallo 2 — Pods en `ErrImagePull` aunque la imagen existe en Docker

**Síntoma:**
```
NAME                      READY   STATUS         RESTARTS
backend-xxx               0/1     ErrImagePull   0
```
La imagen sí aparecía en `docker image ls` del host.

**Causa:**
Minikube tiene su **propio daemon Docker interno**, separado del Docker del host.
Las imágenes construidas en el host no son visibles para los pods de Minikube.

**Fix:** construir las imágenes apuntando al daemon de Minikube:
```bash
eval $(minikube docker-env)
docker build -t backend:latest ./backend
docker build -t frontend:latest ./frontend
eval $(minikube docker-env --unset)
```

Alternativa si ya se construyó en el host:
```bash
minikube image load backend:latest
minikube image load frontend:latest
```

---

## Fallo 3 — `curl` al ClusterIP cuelga sin responder

**Síntoma:**
```bash
curl http://10.110.33.56:8080
# no responde, hay que hacer Ctrl+C
```

**Causa:**
El `ClusterIP` solo es accesible **desde dentro del clúster**. Desde WSL2 (fuera del clúster)
el paquete no tiene ruta y la conexión queda colgada.

**Fix:** usar `port-forward` para exponer el servicio en `localhost`:
```bash
kubectl port-forward service/backend-service 9090:8080
curl http://localhost:9090
```

---

## Fallo 4 — El NodePort de Minikube no es alcanzable desde Windows

**Síntoma:**
El frontend estaba configurado como `NodePort` en el puerto `30080`. La URL
`http://192.168.49.2:30080` no cargaba en el navegador de Windows.

**Causa:**
Minikube corre dentro de WSL2, que a su vez corre dentro de una VM en Windows.
Ese doble NAT impide que Windows alcance directamente la red interna de Minikube.

**Fix:** usar `port-forward` sobre `localhost`, que WSL2 sí reenvía automáticamente a Windows:
```bash
kubectl port-forward service/frontend-service 8888:80
# Abrir en Windows: http://localhost:8888
```

---

## Fallo 5 — Docker caché ignoraba cambios en `nginx.conf`

**Síntoma:**
Se modificó `nginx.conf`, se hizo `docker build` y se recargaron los pods,
pero el pod seguía teniendo la configuración anterior al verificar con:
```bash
kubectl exec <pod> -- cat /etc/nginx/conf.d/default.conf
```

**Causa:**
Docker detectó que las capas anteriores no habían cambiado (falsa invalidación de caché)
y reutilizó la imagen en caché, sin copiar el `nginx.conf` actualizado.
Además, `minikube image load` no siempre sobreescribe correctamente una imagen existente.

**Fix:** forzar rebuild sin caché **y** construir directamente dentro del daemon de Minikube:
```bash
eval $(minikube docker-env)
docker build --no-cache -t frontend:latest ./frontend
eval $(minikube docker-env --unset)
kubectl rollout restart deployment/frontend
```

---

## Fallo 6 — Nginx redirigía `/api` → `/api/` perdiendo el puerto

**Síntoma:**
En el navegador (DevTools → Network):
```
GET http://127.0.0.1/api/   →   ERR_CONNECTION_REFUSED
```
La petición iba al puerto `80` en vez del `8888` del port-forward.

**Causa:**
El componente React llamaba `fetch('/api')` (sin trailing slash).
Nginx con `location /api` redireccionaba a `/api/` generando una URL absoluta
`http://127.0.0.1/api/` donde el puerto `8888` se perdía.
El browser intentaba conectarse al puerto `80` (donde nada escucha) y fallaba.

**Fix:** añadir trailing slash en el fetch de React para evitar el redirect:
```javascript
// Antes
const API_URL = import.meta.env.VITE_API_URL || '/api'

// Después
const API_URL = import.meta.env.VITE_API_URL || '/api/'
```

---

## Fallo 7 — Go redirigía con 301 por doble slash en `proxy_pass`

**Síntoma:**
Aun con `/api/` en el fetch, el navegador recibía:
```
GET http://localhost:8888/api/   →   301 Moved Permanently
```

**Causa:**
La configuración de Nginx era:
```nginx
location /api {
    proxy_pass http://backend-service:8080/;
}
```
Al recibir `/api/`, Nginx calcula el path para el backend así:
- Elimina el prefijo `/api` de `/api/` → queda `/`
- Lo concatena con el URI del `proxy_pass` → `http://backend-service:8080//`

El servidor Go de `net/http` detecta el doble slash `//` y emite un `301` para redirigir
a la ruta limpia `/`. El browser sigue ese redirect pero no puede resolver el destino.

**Fix:** alinear la location y el proxy_pass para que el strip sea exacto:
```nginx
# Después — location y proxy_pass ambos con trailing slash
location /api/ {
    proxy_pass http://backend-service:8080/;
}
```
Con esto, Nginx elimina el prefijo `/api/` de `/api/` → queda vacío (`""`),
lo concatena con `/` del proxy_pass → `http://backend-service:8080/`.
El backend recibe `GET /` limpio y responde JSON sin redirect.

---

## Resumen

| # | Problema | Causa raíz | Fix |
|---|---|---|---|
| 1 | `npm ci` falla | Sin `package-lock.json` | Usar `npm install` |
| 2 | `ErrImagePull` en pods | Daemon Docker separado en Minikube | Construir con `eval $(minikube docker-env)` |
| 3 | `curl` al ClusterIP cuelga | ClusterIP no enrutable desde WSL2 | Usar `kubectl port-forward` |
| 4 | NodePort no alcanzable desde Windows | Doble NAT de WSL2 | `port-forward` sobre `localhost` |
| 5 | Caché Docker ignoraba cambios | Falsa invalidación de caché + `minikube image load` no sobreescribe | `--no-cache` + build dentro del daemon de Minikube |
| 6 | Petición va a puerto 80 en vez de 8888 | Nginx redirige `/api` → `/api/` perdiendo el puerto | Fetch con trailing slash `/api/` |
| 7 | 301 en la llamada al backend | Doble slash `//` en `proxy_pass` → Go redirige | `location /api/` + `proxy_pass http://backend-service:8080/` |
