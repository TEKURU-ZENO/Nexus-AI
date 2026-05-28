import asyncio
import os
from typing import AsyncIterator

from dotenv import load_dotenv

load_dotenv()


class OpenAIService:
    def __init__(self):
        self.model = os.getenv("OPENAI_MODEL", "gpt-5")
        self.api_key = os.getenv("OPENAI_API_KEY")
        self._client = None

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI

            self._client = OpenAI(api_key=self.api_key)
        return self._client

    async def stream_text(self, instructions: str, prompt: str) -> AsyncIterator[str]:
        if not self.enabled:
            return

        queue: asyncio.Queue[str | None] = asyncio.Queue()

        def run_request():
            try:
                client = self._get_client()
                stream = client.responses.create(
                    model=self.model,
                    instructions=instructions,
                    input=prompt,
                    stream=True,
                    max_output_tokens=500,
                )
                for event in stream:
                    event_type = getattr(event, "type", "")
                    if event_type == "response.output_text.delta":
                        queue.put_nowait(getattr(event, "delta", ""))
                queue.put_nowait(None)
            except Exception as exc:
                queue.put_nowait(f"\n[provider warning: {exc}]")
                queue.put_nowait(None)

        asyncio.create_task(asyncio.to_thread(run_request))

        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            if chunk:
                yield chunk


openai_service = OpenAIService()
