# Multimodal Creative Storytelling Agent (Gemini + Vertex AI)

This project is a multimodal storytelling app for hackathon demos. A user enters a topic (for example, `A dragon learning to code`), and the system generates a structured story with interleaved scene narration and image prompts.

## What It Demonstrates

- Gemini model usage on Vertex AI
- Interleaved multimodal storytelling output
- Agent-style content generation through a backend API
- Cloud Run-ready deployment artifacts

## Architecture

```text
User
	|
	v
Next.js Frontend (frontend/)
	|
	v
FastAPI Backend (backend/)
	|
	v
Vertex AI Gemini (gemini-2.0-flash-001)
```

Optional extension:
- Cloud Storage for storing rendered images/audio assets

graph TD
    A[User Input/Topic] -->|Submits to| B(Next.js Frontend React)
    B -->|POST /generate-story| C{FastAPI Backend}
    
    subgraph Google Cloud Platform
    C -->|REST/gRPC via SDK| D[Vertex AI: Gemini 1.5 Pro]
    D -->|Structured Output JSON| C
    end
    
    C -->|Returns Narration + Prompts| B
    B -->|Renders UI| E[Interleaved Multimodal UI]
    
    %% Optional Add-ons if you go further
    D -.->|Optional Imagen 3 Call| F[Google Cloud Storage]
    F -.->|Serves Media| B

## Project Structure

```text
EA1/
	backend/
		main.py
		requirements.txt
		.env.example
	frontend/
		app/
			globals.css
			layout.tsx
			page.tsx
		package.json
		tsconfig.json
		next.config.mjs
		next-env.d.ts
		.env.local.example
	deploy/
		Dockerfile
	Dockerfile
	README.md
```

## API Contract

### Endpoint

`POST /generate-story`

`POST /generate-image`

### Request

```json
{
	"prompt": "A robot who wants to become a dancer"
}
```

### Response

```json
{
	"title": "The Robot Who Danced in Moonlight",
	"scenes": [
		{
			"narration": "...",
			"image_prompt": "..."
		}
	]
}
```

## Local Setup

### 1) Backend (FastAPI)

From workspace root:

```bash
cd backend
python -m venv .venv
```

Windows cmd:

```bash
.venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create environment file from template:

```bash
copy .env.example .env
```

Set required values in `backend/.env`:

- `GOOGLE_CLOUD_PROJECT`
- `GOOGLE_CLOUD_LOCATION` (for example `us-central1`)
- optional: `GEMINI_MODEL`
- optional: `GEMINI_IMAGE_MODEL` (default `imagen-3.0-generate-002`)

Authenticate with Google Cloud ADC:

```bash
gcloud auth application-default login
```

Run backend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

Health check:

`GET http://localhost:8080/health`

### 2) Frontend (Next.js)

Open a second terminal from workspace root:

```bash
cd frontend
npm install
```

Create frontend env file:

```bash
copy .env.local.example .env.local
```

Run frontend:

```bash
npm run dev
```

Then open:

`http://localhost:3000`

## Cloud Run Deployment (Backend)

From workspace root:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/multimodal-storyteller
gcloud run deploy multimodal-storyteller \
	--image gcr.io/PROJECT_ID/multimodal-storyteller \
	--platform managed \
	--region us-central1 \
	--allow-unauthenticated \
	--set-env-vars GOOGLE_CLOUD_PROJECT=PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1,GEMINI_MODEL=gemini-2.0-flash-001
```

If needed, use `deploy/Dockerfile` instead of root `Dockerfile`.

## Example Demo Prompts

- `A dragon learning to code`
- `Explain photosynthesis as a children's story`
- `A pirate adventure with a talking parrot`
- `A shy astronaut learning teamwork on Mars`

## Demo Scenario (Hackathon)

1. User enters: `A pirate adventure with a talking parrot`
2. Frontend sends prompt to `POST /generate-story`
3. Backend asks Gemini for strict JSON output
4. UI renders interleaved scenes:
	 - Scene narration
	 - Illustration prompt
	 - Placeholder image slot for future image render integration

## Notes

- Current implementation generates text and image prompts.
- You can add real image generation/rendering in each scene slot as a next enhancement.
