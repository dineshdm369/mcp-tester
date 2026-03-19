.PHONY: install dev build stop

install:
	pip install -e ".[api]"
	cd frontend && npm install

dev:
	@echo "→ Starting API on :8001 and UI on :5173"
	uvicorn mcp_tester.api:app --host 127.0.0.1 --port 8001 --reload &
	cd frontend && npm run dev

stop:
	@pkill -f "uvicorn mcp_tester.api" 2>/dev/null || true
	@echo "stopped"

build:
	cd frontend && npm run build

lint-frontend:
	cd frontend && npx tsc --noEmit
