# Kubernetes Deployment — meme.maulanamalik.my.id

## Prasyarat
- Cluster Kubernetes 1.24+ (cek `kubectl version`)
- Ingress controller **ingress-nginx** terinstal
- (Opsional, untuk HTTPS) **cert-manager** + `ClusterIssuer` bernama `letsencrypt-prod`
- DNS A-record `meme.maulanamalik.my.id` → IP ingress
- Container registry (Docker Hub / GHCR) untuk push image

## 1. Build & push image

```bash
# Backend
docker build -t ghcr.io/YOUR_USER/sol-screener-backend:latest ./backend
docker push  ghcr.io/YOUR_USER/sol-screener-backend:latest

# Frontend — bake REACT_APP_BACKEND_URL ke domain produksi
docker build \
  --build-arg REACT_APP_BACKEND_URL=https://meme.maulanamalik.my.id \
  -t ghcr.io/YOUR_USER/sol-screener-frontend:latest ./frontend
docker push ghcr.io/YOUR_USER/sol-screener-frontend:latest
```

> Ganti `ghcr.io/YOUR_USER/...` di `k8s/deployment.yaml` sesuai registry-mu.

## 2. Buat namespace & secret

```bash
kubectl apply -f k8s/deployment.yaml      # bikin namespace + configmap + deployment
# OVERRIDE secret yang dummy dengan yang asli:
kubectl create secret generic sol-secrets -n sol-screener \
  --from-literal=MONGO_USER='screener' \
  --from-literal=MONGO_PASSWORD='SUPER_STRONG_PASSWORD' \
  --from-literal=ANTHROPIC_API_KEY='sk-ant-api03-...' \
  --from-literal=TELEGRAM_BOT_TOKEN='123456:AAH...' \
  --from-literal=TELEGRAM_CHAT_ID='123456789' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## 3. Apply services & ingress

```bash
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

## 4. Cek status

```bash
kubectl get all -n sol-screener
kubectl logs -n sol-screener deploy/backend  | tail -30
```

Pada log backend, akan muncul banner konfigurasi:
```
SOL/SCREENER backend starting
  MongoDB     : mongo:27017  (db=sol_screener)
  Anthropic   : SET (sk-ant-a…fakek)  model=claude-sonnet-4-5-20250929
  Telegram Bot: SET (123456…AAH)
  Telegram CHT: SET (123…789)
  ...
```

Kalau ada yang `NOT SET` di sini, berarti secret belum termount — recheck step 2.

## 5. Akses

- Buka https://meme.maulanamalik.my.id
- Frontend → ingress → service `frontend` (nginx)
- Frontend memanggil `https://meme.maulanamalik.my.id/api/...` → ingress route ke service `backend`

## 6. Update / rollout

```bash
kubectl rollout restart deploy/backend  -n sol-screener
kubectl rollout restart deploy/frontend -n sol-screener
```

## 7. Hapus semua

```bash
kubectl delete namespace sol-screener
```
