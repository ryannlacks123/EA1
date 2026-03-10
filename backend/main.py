import base64
import json
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv()

MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash-001")
IMAGE_MODEL_NAME = os.getenv("GEMINI_IMAGE_MODEL", "imagen-3.0-generate-002")

# Vertex client uses ADC auth and standard env vars:
# GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION
client = genai.Client(vertexai=True)

app = FastAPI(title="Gemini Multimodal Storyteller", version="1.0.0")

# Keep this open for local hackathon dev; lock down in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class StoryRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=500)


class Scene(BaseModel):
    narration: str
    image_prompt: str


class StoryResponse(BaseModel):
    title: str
    scenes: list[Scene] = Field(..., min_length=3, max_length=5)


class ImageRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000)


class ImageResponse(BaseModel):
    image_base64: str
    mime_type: str
    revised_prompt: str | None = None


def _extract_json(response_text: str) -> dict[str, Any]:
    """Accept plain JSON or fenced JSON blocks and return a parsed object."""
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()
    return json.loads(cleaned)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/generate-story", response_model=StoryResponse)
def generate_story(request: StoryRequest) -> StoryResponse:
    try:
        prompt = f"""
You are a creative storyteller.

Generate a short illustrated story based on the user prompt.

User prompt: {request.prompt}

Return valid JSON only with this exact structure:
{{
  "title": "string",
  "scenes": [
    {{
      "narration": "string",
      "image_prompt": "string"
    }}
  ]
}}

Rules:
- Create 3 to 5 scenes.
- Keep narration child-friendly and cohesive across scenes.
- Make each image_prompt visually detailed for image generation.
- Do not include markdown or extra keys.
""".strip()

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=StoryResponse,
                temperature=0.9,
                top_p=0.95,
            ),
        )

        if not response.text:
            raise HTTPException(status_code=502, detail="Gemini returned an empty response")

        parsed = _extract_json(response.text)
        return StoryResponse.model_validate(parsed)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc


@app.post("/generate-image", response_model=ImageResponse)
def generate_image(request: ImageRequest) -> ImageResponse:
    try:
        response = client.models.generate_images(
            model=IMAGE_MODEL_NAME,
            prompt=request.prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                include_rai_reason=True,
                output_mime_type="image/png",
            ),
        )

        if not response.generated_images:
            raise HTTPException(status_code=502, detail="Image model returned no images")

        for generated in response.generated_images:
            if generated.image and generated.image.image_bytes:
                mime_type = generated.image.mime_type or "image/png"
                image_b64 = base64.b64encode(generated.image.image_bytes).decode("ascii")
                return ImageResponse(
                    image_base64=image_b64,
                    mime_type=mime_type,
                    revised_prompt=generated.enhanced_prompt,
                )

        filtered_reason = response.generated_images[0].rai_filtered_reason
        message = "Image generation returned no usable image"
        if filtered_reason:
            message = f"Image blocked by safety filters: {filtered_reason}"
        raise HTTPException(status_code=502, detail=message)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Image generation failed: {exc}") from exc