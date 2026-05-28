from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.routes.mission import router as mission_router
from server.services.openai_service import openai_service

app = FastAPI(title="NEXUS API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mission_router, prefix="/api")


@app.get("/health")
async def health():
    return {
        "status": "online",
        "system": "NEXUS",
        "openai_enabled": openai_service.enabled
    }

