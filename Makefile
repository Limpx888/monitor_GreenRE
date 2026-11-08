.PHONY: help install build run test test-unit clean seed up down

help:
	@echo "GreenRE EcoPulse EMS - Engineering Commands"
	@echo "  make install     - Install frontend & backend dependencies"
	@echo "  make run         - Run backend and frontend locally in development"
	@echo "  make test        - Run comprehensive enterprise test suite"
	@echo "  make seed        - Populate physical spatial hierarchy and tariff seed data"
	@echo "  make clean       - Remove cache, bytecode, and temp DB files"
	@echo "  make up          - Start services via docker-compose (with TimescaleDB)"
	@echo "  make down        - Tear down docker-compose containers"

install:
	pip install -r backend/requirements.txt
	npm --prefix frontend install

build:
	npm --prefix frontend run build

run-backend:
	python -m uvicorn backend.main:app --host 127.0.0.1 --port 5000 --reload

run-frontend:
	npm --prefix frontend run dev

test:
	python tests/test_enterprise_standards.py

seed:
	python backend/seed.py

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.db-wal" -delete
	find . -type f -name "*.db-shm" -delete

up:
	docker-compose up -d

down:
	docker-compose down

