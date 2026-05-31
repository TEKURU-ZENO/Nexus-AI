import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from server.services.mission_service import stream_mission

router = APIRouter()


class MissionRequest(BaseModel):
    mission: str
    mode: str = "Strategic Planning"
    refinement: str = None


@router.post("/mission/stream")
async def mission_stream(request: MissionRequest):
    async def event_stream():
        async for event in stream_mission(request.mission, request.mode, request.refinement):
            yield json.dumps(event) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")

