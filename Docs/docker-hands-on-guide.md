# 🐳 Docker Hands-On Guide
### Basics → Images → Containers → Dockerfile → Volumes → Networks → Compose → CRUDOPS (React + FastAPI + MongoDB)

> Follow the steps in order. Every step = **one idea + one diagram + the commands**.

---

## 0. Map of What We Will Learn

```
 Dockerfile ──build──▶ IMAGE ──run──▶ CONTAINER ──▶ App running
                         │                │
                      push/pull       ┌───┴────┐
                         │            ▼        ▼
                     REGISTRY      VOLUME   NETWORK
                    (Docker Hub)  (data)    (talk to other containers)
                                      └───┬────┘
                                          ▼
                                   DOCKER COMPOSE
                                (many containers, 1 file)
```

---

## 1. What & Why

**Problem:** "It works on my machine."
**Fix:** Package app + dependencies + runtime together → run the same everywhere.

```
 WITHOUT DOCKER                     WITH DOCKER
 ┌────────────────┐                 ┌────────────────────┐
 │ Install Python │                 │  Image             │
 │ Install libs   │   ──────▶       │  (app + python +   │
 │ Install DB     │                 │   libs + config)   │
 │ Configure OS   │                 └─────────┬──────────┘
 │ Hope it works  │                           ▼
 └────────────────┘                  docker run → works anywhere
```

### Docker vs Virtual Machine

```
   VIRTUAL MACHINE                     DOCKER
 ┌─────┐ ┌─────┐ ┌─────┐          ┌─────┐ ┌─────┐ ┌─────┐
 │ App │ │ App │ │ App │          │ App │ │ App │ │ App │
 ├─────┤ ├─────┤ ├─────┤          └──┬──┘ └──┬──┘ └──┬──┘
 │Guest│ │Guest│ │Guest│          ┌──┴───────┴───────┴──┐
 │ OS  │ │ OS  │ │ OS  │          │    Docker Engine    │
 ├─────┴─┴─────┴─┴─────┤          ├─────────────────────┤
 │     Hypervisor      │          │     Host OS         │
 ├─────────────────────┤          └─────────────────────┘
 │      Host OS        │          Shares host kernel →
 └─────────────────────┘          light, fast, small
```

---

## 2. Core Terms (10-second version)

| Term | Meaning | Analogy |
|---|---|---|
| **Image** | Read-only template | Class / Recipe |
| **Container** | Running instance of an image | Object / Cooked dish |
| **Dockerfile** | Instructions to build an image | Recipe steps |
| **Registry** | Store for images (Docker Hub, ECR…) | GitHub for images |
| **Volume** | Persistent storage | External hard disk |
| **Network** | Lets containers talk | Private LAN |
| **Compose** | Run multi-container apps from one YAML | Orchestra conductor |

```
              Docker CLI  (docker run, docker ps ...)
                   │
                   ▼
             Docker Engine
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
     Images    Containers  Networks    Volumes
```

---

## 3. Install & Verify

Windows → install **Docker Desktop** (WSL 2 backend). Start it, then:

```bash
docker --version        # CLI installed?
docker version          # client + server versions
docker info             # engine details (fails if Docker Desktop not running)
docker run hello-world  # full pipeline test
```

```
docker run hello-world
   │
   ├─ image local? ── no ──▶ pull from Docker Hub
   ├─ create container
   ├─ run → prints message
   └─ exit
```

---

## 4. Container Lifecycle (Hands-on with Nginx)

### 4.1 Lifecycle Diagram

```
            docker create             docker start
  IMAGE ───────────────────▶ CREATED ─────────────▶ RUNNING ◀──┐
    │                                                │  │      │ docker
    │ docker run (create + start in one)             │  │      │ restart
    └───────────────────────────────────────────────▶┘  │      │
                                          docker pause ─┤      │
                                                        ▼      │
                                  docker stop/kill ──▶ STOPPED ┘
                                                        │
                                                 docker rm
                                                        ▼
                                                    REMOVED
```

### 4.2 Run commands

```bash
docker run nginx                              # foreground (CTRL+C to stop)
docker run -d nginx                           # detached (background)
docker run -d --name my-nginx nginx           # with a name
docker run -d --name web -p 8080:80 nginx     # with port mapping → http://localhost:8080
```

### 4.3 Observe

```bash
docker ps                 # running containers
docker ps -a              # ALL containers (incl. stopped)
docker ps -q              # only IDs
docker logs web           # logs
docker logs -f web        # follow logs (CTRL+C to leave)
docker logs --tail 20 web # last 20 lines
docker inspect web        # full JSON details (IP, mounts, env...)
docker stats              # live CPU / RAM
docker top web            # processes inside container
docker port web           # port mappings
```

### 4.4 Control

```bash
docker stop web           # graceful stop
docker start web          # start again
docker restart web        # stop + start
docker pause web          # freeze processes
docker unpause web
docker kill web           # force stop immediately
docker rename web web2    # rename
docker rm web2            # remove (must be stopped)
docker rm -f web2         # force remove (even if running)
```

### 4.5 Go inside a container

```bash
docker exec -it web sh            # open shell   (-i interactive, -t terminal)
docker exec web ls /usr/share/nginx/html   # run one command
docker cp web:/etc/nginx/nginx.conf .      # copy FROM container to host
docker cp ./index.html web:/usr/share/nginx/html/   # copy TO container
```

### 4.6 Port Mapping

```
 -p 8080:80
     │    └── container port (nginx listens here)
     └─────── host port (you open this in browser)

 Browser ──▶ localhost:8080 ──▶ [Docker] ──▶ container:80 ──▶ nginx
```

### 4.7 Environment variables

```bash
docker run -d --name env-demo -e APP_ENV=dev nginx
docker exec env-demo env | grep APP_ENV
docker rm -f env-demo
```

---

## 5. Images

```
 Image = stack of read-only LAYERS
 ┌──────────────────────────┐
 │ CMD ["python","app.py"]  │  ← layer 4  (metadata)
 │ COPY app.py .            │  ← layer 3
 │ WORKDIR /app             │  ← layer 2
 │ python:3.13-slim (base)  │  ← layer 1
 └──────────────────────────┘
 Container = image layers + 1 thin WRITABLE layer on top
```

```
 One image ──▶ many containers
            nginx image
        ┌───────┼───────┐
        ▼       ▼       ▼
     nginx-1  nginx-2  nginx-3
```

```bash
docker images                      # list images (same: docker image ls)
docker pull nginx                  # download (latest tag)
docker pull nginx:1.27             # specific tag      → image:tag
docker pull python:3.13-slim
docker pull mongo:8
docker image inspect nginx         # details
docker history nginx               # see layers
docker tag nginx my-nginx:v1       # give another name/tag
docker rmi my-nginx:v1             # remove image (-f to force)
docker search redis                # search Docker Hub
```

---

## 6. Build Your Own Image

### 6.1 Project

```
docker-demo/
├── app.py
├── Dockerfile
└── .dockerignore
```

**app.py**
```python
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-type", "text/plain")
        self.end_headers()
        self.wfile.write(b"Hello from Docker!")

print("Server running on port 8000")
HTTPServer(("0.0.0.0", 8000), Handler).serve_forever()   # 0.0.0.0 = reachable from outside container
```

**Dockerfile**
```docker
FROM python:3.13-slim
WORKDIR /app
COPY app.py .
EXPOSE 8000
CMD ["python", "app.py"]
```

**.dockerignore**
```
__pycache__
*.pyc
.venv
venv
.git
.env
.vscode
```

### 6.2 Dockerfile instructions cheat-sheet

```
 FROM      → base image to start from
 WORKDIR   → cd into folder (creates it)
 COPY      → host files → image
 RUN       → command at BUILD time   (pip install ...)
 CMD       → default command at RUN time (can be overridden)
 ENTRYPOINT→ fixed main executable   (CMD becomes its arguments)
 EXPOSE    → documents port (does NOT publish it!)
 ENV       → environment variable
 ARG       → build-time variable
 USER      → run as this user (use non-root)
 HEALTHCHECK → how Docker checks app is healthy
```

```
 BUILD TIME                    RUN TIME
 ──────────                    ────────
 FROM, COPY, RUN, ARG   │   CMD, ENTRYPOINT, ENV, EXPOSE
 (runs on docker build) │   (used on docker run)
```

### 6.3 Build → Run → Test

```bash
docker build -t my-python-app .                  # build  (-t name, . = context)
docker build -t my-python-app:1.0 .              # with version tag
docker build --no-cache -t my-python-app .       # ignore cache

docker run -d --name python-container -p 8000:8000 my-python-app
curl http://localhost:8000                       # → Hello from Docker!
docker logs python-container                     # → Server running on port 8000

docker stop python-container && docker rm python-container
```

```
 app.py + Dockerfile ──docker build──▶ Image ──docker run──▶ Container ──▶ localhost:8000
```

### 6.4 Layer caching — order matters!

```
 ❌ BAD                        ✅ GOOD
 COPY . .                      COPY requirements.txt .
 RUN pip install -r req...     RUN pip install -r requirements.txt   ← cached unless deps change
                               COPY . .                              ← only this re-runs on code change
```

### 6.5 Push to Docker Hub

```bash
docker login
docker tag my-python-app YOUR_USERNAME/my-python-app:1.0
docker push YOUR_USERNAME/my-python-app:1.0
docker pull YOUR_USERNAME/my-python-app:1.0     # on any other machine
docker logout
```

```
 Your PC ──push──▶ Docker Hub ──pull──▶ Server / Teammate
```

---

## 7. Volumes (Persistent Data)

Containers are temporary. Delete container → data inside is **lost**. Volumes fix this.

```
 WITHOUT VOLUME                   WITH VOLUME
 Container ──rm──▶ data gone      Container ──rm──▶ Volume still has data
                                  New container ──mount──▶ data is back ✅
```

```bash
docker volume create my-volume
docker volume ls
docker volume inspect my-volume

docker run -d --name vol-demo -v my-volume:/data ubuntu sleep infinity
docker exec vol-demo sh -c "echo hello > /data/test.txt"
docker rm -f vol-demo                              # delete container

docker run --rm -v my-volume:/data ubuntu cat /data/test.txt   # data still there! (--rm = auto-delete)
docker volume rm my-volume
```

### Volume vs Bind Mount

```
 VOLUME                          BIND MOUNT
 -v my-volume:/data              -v ./html:/usr/share/nginx/html
 Docker manages location         You choose host folder
 Use for: databases              Use for: live code editing (dev)
```

```bash
# Bind mount demo — edit ./html/index.html and refresh browser
mkdir html && echo "<h1>Hi from bind mount</h1>" > html/index.html
docker run -d --name nginx-dev -p 8080:80 -v "$(pwd)/html":/usr/share/nginx/html nginx
```

---

## 8. Networks

```
 Default: containers on same custom network find each other BY NAME (built-in DNS)

         my-network
   ┌─────────┴─────────┐
   ▼                   ▼
 backend  ──────▶  mongodb:27017
```

```bash
docker network ls
docker network create my-network
docker network inspect my-network

docker run -d --name mongodb --network my-network mongo:8
docker run -it --rm --network my-network alpine ping mongodb    # name resolves ✅

docker network connect my-network some-container
docker network disconnect my-network some-container
docker network rm my-network
```

### ⚠️ The `localhost` trap

```
 Inside backend container:
   localhost      → the backend container ITSELF   ❌
   mongodb        → the MongoDB container          ✅

 ✅ mongodb://mongodb:27017
 ❌ mongodb://localhost:27017
```

Network types: `bridge` (default), `host` (share host network), `none` (isolated).

---

## 9. Docker Compose

One YAML file → whole application.

```
 Without Compose                 With Compose
 docker run ... (mongo)          docker compose up
 docker run ... (backend)        (builds + networks + volumes + starts all)
 docker run ... (frontend)
 docker network create ...
 docker volume create ...
```

### Compose commands

```bash
docker compose up                # start (foreground)
docker compose up -d             # start in background
docker compose up --build        # rebuild images first
docker compose ps                # status
docker compose logs              # all logs
docker compose logs -f backend   # follow one service
docker compose exec backend sh   # shell in a service
docker compose build             # build only
docker compose pull              # pull images
docker compose restart           # restart all
docker compose stop              # stop (keeps containers)
docker compose start             # start again
docker compose down              # remove containers + network
docker compose down -v           # ⚠️ also delete volumes (DB data!)
docker compose config            # validate / view final YAML
```

---

## 10. 🚀 Final Project — CRUDOPS (React + FastAPI + MongoDB)

### 10.1 Architecture

```
                 Browser  (http://localhost:3000)
                    │
                    ▼
        ┌──────────────────────┐
        │  frontend (Nginx)    │  React build served on port 80
        │  host 3000 → 80      │
        └──────────┬───────────┘
                   │  browser calls API directly
                   ▼  http://localhost:8000/api
        ┌──────────────────────┐
        │  backend (FastAPI)   │  host 8000 → 8000
        └──────────┬───────────┘
                   │  mongodb://mongo:27017
                   ▼
        ┌──────────────────────┐
        │  mongo (MongoDB 8)   │──▶ Volume: mongo_data
        └──────────────────────┘
        all three on network: crudops-network
```

### 10.2 Folder structure

```
crudops/
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py        # FastAPI app, /health, CORS, router at /api
│       ├── database.py    # MongoClient(MONGO_URL) → crudops.users
│       ├── models.py      # UserCreate, UserUpdate
│       └── routes.py      # GET/POST/PUT/DELETE /users
└── frontend/
    ├── Dockerfile
    ├── .dockerignore
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        └── index.css
```

### 10.3 Backend Dockerfile — multi-stage build

```
 STAGE 1: builder                         STAGE 2: runtime
 ┌─────────────────────────┐              ┌─────────────────────────┐
 │ python:3.14-slim        │              │ python:3.14-slim        │
 │ + gcc (compile deps)    │  copy /opt/  │ (no gcc, no pip cache)  │
 │ + venv with all pip pkgs│ ───venv────▶ │ + venv + app code       │
 └─────────────────────────┘              │ runs as NON-ROOT user   │
      thrown away ✂️                       └─────────────────────────┘
                                                  small & safer ✅
```

```docker
FROM python:3.14-slim AS builder
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM python:3.14-slim AS runtime
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/opt/venv/bin:$PATH"
COPY --from=builder /opt/venv /opt/venv
COPY app ./app
RUN useradd --create-home appuser
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 10.4 Frontend Dockerfile — multi-stage build

```
 STAGE 1: build (node:22-alpine)          STAGE 2: serve (nginx:alpine)
 npm install → npm run build ──/app/dist──▶ /usr/share/nginx/html
 (Node discarded after build)               + nginx.conf (SPA routing)
```

```docker
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 10.5 docker-compose.yml

```yaml
services:
  mongo:
    image: mongo:8
    container_name: crudops-mongo
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
      - mongo_config:/data/configdb
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [crudops-network]

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: crudops-backend
    restart: unless-stopped
    environment:
      MONGO_URL: mongodb://mongo:27017      # service name = hostname
    ports:
      - "8000:8000"
    depends_on:
      mongo:
        condition: service_healthy          # wait until Mongo is READY
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [crudops-network]

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: crudops-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy
    networks: [crudops-network]

networks:
  crudops-network:
    driver: bridge

volumes:
  mongo_data:
  mongo_config:
```

### 10.6 Startup order

```
 docker compose up --build
        │
        ▼
 create network ─▶ create volumes
        │
        ▼
 start MONGO ──(healthcheck: ping OK?)──▶ healthy ✅
        │
        ▼
 start BACKEND ──(healthcheck: /health OK?)──▶ healthy ✅
        │
        ▼
 start FRONTEND
```

### 10.7 Run it

```bash
cd crudops
docker compose config               # validate YAML
docker compose up --build -d        # build + start in background
docker compose ps                   # all 3 should be "healthy"/"running"
docker compose logs -f backend      # watch backend logs
```

### 10.8 Test it

| What | URL |
|---|---|
| React UI | http://localhost:3000 |
| API root | http://localhost:8000 |
| Health | http://localhost:8000/health |
| Swagger | http://localhost:8000/docs |

**Users API**

```
 GET    /api/users            → list users
 POST   /api/users            → create user
 PUT    /api/users/{email}    → update user (name, age, gender, city)
 DELETE /api/users/{email}    → delete user
```

```bash
# Create
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Ravi","age":25,"gender":"Male","city":"Guntur","email":"ravi@example.com"}'

# List
curl http://localhost:8000/api/users

# Update
curl -X PUT http://localhost:8000/api/users/ravi@example.com \
  -H "Content-Type: application/json" \
  -d '{"city":"Hyderabad"}'

# Delete
curl -X DELETE http://localhost:8000/api/users/ravi@example.com
```

> 💡 On Windows PowerShell/CMD, use `curl.exe` and escape quotes (`"{\"name\":\"Ravi\"}"`), or just use Swagger/Postman.

### 10.9 Look inside the running stack

```bash
docker compose exec backend sh                       # shell in backend
docker compose exec mongo mongosh                    # Mongo shell
#   inside mongosh:
#   use crudops
#   db.users.find()

docker network inspect crudops_crudops-network       # see all 3 containers on the network
docker volume ls                                     # mongo_data, mongo_config
docker stats                                         # CPU / RAM of all containers
docker compose exec backend whoami                   # → appuser (non-root ✅)
```

### 10.10 Prove the volume works

```bash
# 1. add a user via the UI, then:
docker compose down              # removes containers + network (volume stays)
docker compose up -d             # start again
# 2. refresh UI → user is STILL there ✅

docker compose down -v           # ⚠️ deletes volume
docker compose up -d             # DB is empty now
```

### 10.11 Change code → rebuild

```bash
docker compose up --build -d                 # rebuild everything changed
docker compose build backend                 # rebuild only backend
docker compose up -d --no-deps backend       # restart only backend
```

### 10.12 Stop / clean

```bash
docker compose stop        # stop, keep containers
docker compose start       # resume
docker compose down        # remove containers + network
docker compose down -v     # + remove volumes (DB data lost)
```

---

## 11. 🔧 Exec & Debugging Lab

### 11.1 `docker exec` toolbox

```
 docker exec = run a command INSIDE an already-running container

 Your terminal ──▶ Docker Engine ──▶ [ running container ] ──▶ output back to you
```

```bash
# Interactive shell (-i keep input open, -t give a terminal)
docker exec -it crudops-backend sh
docker exec -it crudops-mongo bash            # mongo image has bash
docker compose exec backend sh                # same, using the service name

# One-off commands (no shell needed)
docker exec crudops-backend ls /app/app       # list code inside image
docker exec crudops-backend whoami            # → appuser (non-root)
docker exec crudops-backend env               # all env vars
docker exec crudops-backend env | grep MONGO  # → MONGO_URL=mongodb://mongo:27017
docker exec crudops-backend ps aux            # running processes (if ps exists)
docker exec crudops-backend pip list          # installed Python packages

# Run as root (when appuser lacks permission, e.g. to install a debug tool)
docker exec -u root -it crudops-backend sh

# Run in a specific folder / with extra env var
docker exec -w /app -e DEBUG=1 crudops-backend ls

# MongoDB shell
docker exec -it crudops-mongo mongosh crudops
#   db.users.find().pretty()
#   db.users.countDocuments()
#   exit
docker exec crudops-mongo mongosh crudops --eval "db.users.find()"   # one-liner
```

> 💡 Slim images usually have **no `curl`**. Use Python inside the backend container instead (see below). Changes made with `exec` live only in that container and vanish when it is recreated — fix things in the Dockerfile / code for real.

### 11.2 Connectivity checks between containers

```
 frontend ──?──▶ backend ──?──▶ mongo
 Test each arrow separately:
```

```bash
# 1. Can backend resolve the 'mongo' hostname? (Docker DNS)
docker exec crudops-backend python -c "import socket; print(socket.gethostbyname('mongo'))"

# 2. Can backend reach Mongo's port?
docker exec crudops-backend python -c "import socket; s=socket.create_connection(('mongo',27017),3); print('mongo reachable')"

# 3. Is the backend healthy from inside itself?
docker exec crudops-backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/health').read())"

# 4. Can frontend container reach backend by service name? (alpine has wget)
docker exec crudops-frontend wget -qO- http://backend:8000/health

# 5. From your PC (host) — is the port published?
curl http://localhost:8000/health
docker port crudops-backend                   # → 8000/tcp -> 0.0.0.0:8000

# 6. Who is on the network?
docker network inspect crudops_crudops-network
```

### 11.3 Debugging commands at a glance

```
 WHAT'S HAPPENING?            →  docker compose ps  /  docker ps -a
 WHY DID IT FAIL?             →  docker compose logs --tail 50 <service>
 LIVE VIEW                    →  docker compose logs -f <service>
 WHAT CONFIG IS IT USING?     →  docker inspect <name>   /   docker compose config
 EXIT CODE?                   →  docker inspect -f '{{.State.ExitCode}}' <name>
 HEALTH STATUS?               →  docker inspect -f '{{.State.Health.Status}}' <name>
 HEALTHCHECK OUTPUT?          →  docker inspect -f '{{json .State.Health}}' <name>
 IP ADDRESS?                  →  docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <name>
 CPU / RAM HOG?               →  docker stats
 LOOK INSIDE                  →  docker exec -it <name> sh
 WHAT CHANGED IN FILESYSTEM?  →  docker diff <name>
 LIVE DOCKER EVENTS           →  docker events
 IMAGE LAYERS / SIZE          →  docker history <image>
```

**Exit codes cheat-sheet**

| Code | Meaning |
|---|---|
| `0` | Finished normally |
| `1` | App error (check logs) |
| `125/126/127` | Docker / permission / command-not-found problem |
| `137` | Killed (out of memory or `docker kill`) |
| `143` | Stopped gracefully (SIGTERM) |

### 11.4 Debugging flowchart

```
 Something not working?
        │
        ▼
 docker compose ps ──▶ container Exited / unhealthy?
        │                         │
        │ yes                     ▼
        ▼               docker compose logs <service>
 Read the error                   │
        │            ┌────────────┼─────────────────┐
        ▼            ▼            ▼                 ▼
  Port in use?   DB refused?   Page loads but    Old code
  change host    use service   no data?          still running?
  port or kill   name, NOT     check API_URL,    docker compose
  process        localhost     CORS, backend     up --build
                               logs
```

### 11.5 Break-and-Fix Lab (do these on CRUDOPS!)

Start with the stack running: `docker compose up --build -d`

#### 🧪 Scenario 1 — Wrong database URL

```
 Edit docker-compose.yml:  MONGO_URL: mongodb://localhost:27017   ← wrong on purpose
```
```bash
docker compose up -d                  # recreates backend with new env (no rebuild needed)
docker compose ps                     # backend still "healthy" 🤔
curl http://localhost:8000/health     # OK — /health never touches the DB
curl http://localhost:8000/api/users  # hangs ~30s then 500 error
docker compose logs --tail 30 backend # → ServerSelectionTimeoutError ... localhost:27017
docker exec crudops-backend env | grep MONGO   # confirm the wrong value
```
**Fix:** set `mongodb://mongo:27017` → `docker compose up -d`.
**Lesson:** a green healthcheck ≠ working DB. `localhost` inside a container is the container itself.

#### 🧪 Scenario 2 — Database goes down

```bash
docker compose stop mongo
curl http://localhost:8000/api/users   # fails (timeout / 500)
docker compose logs --tail 20 backend
docker compose start mongo
docker compose ps                      # wait until mongo is healthy
curl http://localhost:8000/api/users   # works again ✅ (PyMongo reconnects)
```

#### 🧪 Scenario 3 — Code bug crashes the backend

```
 Add a typo in backend/app/routes.py  (e.g. "from .database import users_collectio")
```
```bash
docker compose up --build -d
docker compose ps -a                   # backend: Exited / Restarting; frontend never starts
docker compose logs --tail 30 backend  # → ImportError: cannot import name ...
docker inspect -f '{{.State.ExitCode}}' crudops-backend   # → 1
```
```
 backend crashes ─▶ never becomes healthy ─▶ frontend (depends_on: service_healthy) waits forever
```
**Fix:** correct the typo → `docker compose up --build -d`.
**Lesson:** read the logs *first*; the error is usually on the last lines.

#### 🧪 Scenario 4 — Port already in use

```bash
docker run -d --name blocker -p 8000:80 nginx     # steal port 8000
docker compose up -d backend                      # → "port is already allocated"
docker ps --format "table {{.Names}}\t{{.Ports}}" # find who owns 8000
docker rm -f blocker                              # free it
docker compose up -d backend                      # works ✅
```
Windows (non-Docker process): `netstat -ano | findstr :8000` → `taskkill /PID <pid> /F`

#### 🧪 Scenario 5 — "Changed code but nothing changed"

```bash
# edit backend/app/main.py  (e.g. change the root message)
curl http://localhost:8000/                        # old message 😕
docker compose up --build -d backend               # rebuild image + recreate container
curl http://localhost:8000/                        # new message ✅
```
**Why:** code is **copied into the image** at build time (`COPY app ./app`) → rebuild needed.

#### 🧪 Scenario 6 — UI loads but shows no users

```
 Browser DevTools (F12) → Network tab → look at the /api/users request
```
```bash
curl http://localhost:8000/api/users                       # does the API answer?
docker compose logs -f backend                             # watch live while you click in UI
docker exec crudops-mongo mongosh crudops --eval "db.users.find()"   # is data in DB?
```
```
 Empty [] from API + data in DB?   → check collection/db name in database.py
 Network error in browser?         → backend port not published / CORS / wrong API_URL
 409 on create?                    → email already exists (by design)
```

### 11.6 Quick problem table

| Problem | Check / Fix |
|---|---|
| Container exits immediately | `docker ps -a` → `docker logs <name>` |
| `port is already allocated` | `netstat -ano \| findstr :8000` or change to `-p 8001:8000` |
| App unreachable | `--host 0.0.0.0` in uvicorn **and** `-p` published |
| DB connection failed | Use `mongodb://mongo:27017` (service name), check `docker compose logs mongo` |
| Code change not reflected | Rebuild: `docker compose up --build` |
| Slow builds | Order Dockerfile for caching, use `.dockerignore` |
| Frontend can't reach API | `API_URL` in `App.jsx` is `http://localhost:8000/api` (browser-side) → backend port 8000 must be published |

---

## 12. Cleanup

```bash
docker container prune        # remove stopped containers
docker image prune            # remove dangling images
docker image prune -a         # remove ALL unused images
docker volume prune           # remove unused volumes   ⚠️ data
docker network prune          # remove unused networks
docker system df              # see disk usage
docker system prune           # containers + networks + dangling images
docker system prune -a        # ⚠️ aggressive: all unused images too

# Remove everything (careful!)
docker rm -f $(docker ps -aq)
docker rmi -f $(docker images -q)
```

---

## 13. Best Practices Checklist

```
 ✅ Small base image (slim / alpine)         ✅ Use .dockerignore
 ✅ Multi-stage builds                       ✅ Copy requirements first (cache)
 ✅ Run as non-root (USER appuser)           ✅ Pin versions (python:3.14-slim, mongo:8)
 ✅ Healthchecks                             ✅ Config via env variables
 ✅ Named volumes for DB data                ❌ Never put secrets in Dockerfile / image
 ❌ Never commit .env                        ❌ Don't use "latest" in production
```

> **Note for production:** In this project `allow_origins=["*"]` (CORS) and Mongo without authentication are fine for learning, but should be locked down in real deployments.

---

## 14. Master Cheat Sheet

### Containers
```bash
docker run -d --name n -p H:C -e K=V -v vol:/path --network net image
docker ps / ps -a / ps -q
docker start | stop | restart | pause | unpause | kill | rm | rm -f  <name>
docker logs -f --tail 50 <name>
docker exec -it <name> sh
docker cp <name>:/path ./   |   docker cp ./file <name>:/path
docker inspect | stats | top | port | rename <name>
```

### Images
```bash
docker images | pull | push | build -t name:tag . | tag | rmi | history | search | image prune
```

### Volumes / Networks
```bash
docker volume    ls | create | inspect | rm | prune
docker network   ls | create | inspect | connect | disconnect | rm | prune
```

### Compose
```bash
docker compose up [-d] [--build] | down [-v] | ps | logs [-f] | exec | build | pull | restart | stop | start | config
```

### `docker run` flags
```
 -d detached      --name name        -p host:container     -e KEY=VAL
 -v vol:/path     --network net      -it interactive tty   --rm auto-delete
 --restart unless-stopped            -w /workdir           -u user
```

---

## 15. Quick Interview Q&A

| Question | Answer |
|---|---|
| Image vs Container? | Image = template; container = running instance |
| RUN vs CMD? | RUN at build time; CMD at container start |
| CMD vs ENTRYPOINT? | ENTRYPOINT = fixed executable; CMD = default args (overridable) |
| EXPOSE vs `-p`? | EXPOSE only documents; `-p` actually publishes |
| Volume vs bind mount? | Volume = Docker-managed (DB); bind = host folder (dev) |
| Why not `localhost` for DB? | It points to the container itself; use service name |
| `down` vs `down -v`? | `-v` also deletes volumes (data loss) |
| Why multi-stage? | Smaller, safer final image (no compilers/build tools) |
| Why copy requirements.txt first? | Layer caching → faster builds |
| `depends_on` vs healthcheck condition? | `depends_on` alone waits for *start*; `service_healthy` waits until *ready* |

---

## 16. The One Mental Model

```
 Dockerfile ─build─▶ Image ─run─▶ Container ─▶ Application
                                      │
                       Volume (data) + Network (communication)
                                      │
                    Compose = many containers managed together
```
