# Attendance Management System

This is a full-stack Attendance Management System featuring a FastAPI backend, a React/Vite frontend, and a MongoDB database.

## Prerequisites

Ensure you have the following installed on your system:
- **Node.js** (v18+ recommended) & npm
- **Python** (v3.9+ recommended)
- **Docker** & **Docker Compose** (for running the MongoDB database)

## Project Structure

- `attendance-backend/`: FastAPI backend application.
- `attendance-frontend/`: React + Vite frontend application.
- `docker-compose.yml`: Docker configuration for the MongoDB replica set.

---

## 🚀 How to Start the Application (Manual Way)

To run the application locally for development, you need to start the database, the backend server, and the frontend server separately.

### 1. Start the Database (MongoDB)

The application uses MongoDB, configured as a replica set (`rs0`) in the `docker-compose.yml` file.

1. Open a terminal in the root directory.
2. Run the following command to start the MongoDB container in the background:
   ```bash
   docker compose up -d mongo
   ```
3. The database will be accessible at `localhost:27017`.

*(Note: If you are connecting from MongoDB Compass or a local script, you can use `mongodb://localhost:27017/attendance?directConnection=true`)*

### 2. Start the Backend (FastAPI)

1. Open a new terminal and navigate to the backend directory:
   ```bash
   cd attendance-backend
   ```
2. Create and activate a Python virtual environment:
   - **Windows:**
     ```bash
     python -m venv .venv
     .venv\Scripts\Activate.ps1
     ```
   - **Mac/Linux:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up the environment variables:
   - Copy `.env.example` to a new file named `.env`:
     ```bash
     cp .env.example .env
     ```
     *(On Windows Command Prompt, use `copy .env.example .env`)*
   - *(Optional)* Update the `.env` file with your specific configurations.
5. Start the FastAPI server using Uvicorn:
   ```bash
   uvicorn app.main:app --reload
   ```
6. The backend server will be running at `http://localhost:8000`. You can access the interactive API documentation at `http://localhost:8000/docs`.

### 3. Start the Frontend (React + Vite)

1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd attendance-frontend
   ```
2. Install the Node.js dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables:
   - Copy `.env.example` to a new file named `.env`:
     ```bash
     cp .env.example .env
     ```
     *(On Windows Command Prompt, use `copy .env.example .env`)*
4. Start the frontend development server:
   ```bash
   npm run dev
   ```
5. The frontend will be accessible at the URL provided in the terminal (usually `http://localhost:5173`).

---

## 🧪 Running Unit Tests

The project is equipped with automated unit tests for both the frontend and backend.

### Backend Tests (Pytest)
The backend uses `pytest` for its testing framework.
1. Navigate to the backend directory:
   ```bash
   cd attendance-backend
   ```
2. Make sure your virtual environment is activated and install the development dependencies:
   ```bash
   pip install -r requirements-dev.txt
   ```
3. Run the tests:
   ```bash
   pytest
   ```

### Frontend Tests (Vitest)
The frontend uses `vitest` for its testing framework.
1. Navigate to the frontend directory:
   ```bash
   cd attendance-frontend
   ```
2. Run the tests once:
   ```bash
   npm run test
   ```
3. Or run the tests in watch mode (reruns tests as you edit files):
   ```bash
   npm run test:watch
   ```

---

## 🐳 Running with Docker

You can run the application entirely using Docker, either service-by-service or all at once using Docker Compose.

### Using Docker Compose (Recommended)

To run the entire stack (Database, Backend, and Frontend) simultaneously using the `docker-compose.yml` file:

1. Open a terminal in the project root.
2. Run the compose stack in detached mode:
   ```bash
   docker compose up -d
   ```
3. The services will be available at:
   - **Frontend**: http://localhost:5173
   - **Backend API**: http://localhost:8000
   - **MongoDB**: localhost:27017
4. To view the logs, run:
   ```bash
   docker compose logs -f
   ```
5. To stop the stack, run:
   ```bash
   docker compose down
   ```

### Using Docker for Each Service Individually

If you prefer to build and run the services individually, you can use standard Docker commands. Note that the backend and frontend containers need to communicate with the MongoDB container, so it's recommended to create a dedicated Docker network.

**1. Create a Docker Network**
```bash
docker network create attendance-net
```

**2. Start MongoDB**
```bash
docker run -d --name mongo --network attendance-net -p 27017:27017 mongo:7.0 --replSet rs0 --bind_ip_all
```
*(Wait a few seconds, then initialize the replica set)*:
```bash
docker exec mongo mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongo:27017'}]})"
```

**3. Run the Backend**
```bash
cd attendance-backend
docker build -t attendance-backend .
docker run -d --name backend --network attendance-net -p 8000:8000 -e MONGO_URI="mongodb://mongo:27017/attendance" attendance-backend
cd ..
```

**4. Run the Frontend**
```bash
cd attendance-frontend
docker build -t attendance-frontend .
docker run -d --name frontend --network attendance-net -p 5173:80 attendance-frontend
cd ..
```


