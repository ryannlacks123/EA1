'use client';

import { useState, type ChangeEvent } from 'react';

type Scene = { narration: string; image_prompt: string };
type Story = { title: string; scenes: Scene[] };
type SceneImage = {
  status: 'idle' | 'loading' | 'done' | 'error';
  dataUrl?: string;
  error?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:8080';

const starterPrompt = 'A pirate adventure with a talking parrot';

export default function Storyteller() {
  const [prompt, setPrompt] = useState(starterPrompt);
  const [story, setStory] = useState<Story | null>(null);
  const [sceneImages, setSceneImages] = useState<SceneImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [imageProgress, setImageProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const generateImages = async (scenes: Scene[]) => {
    setImageProgress({ done: 0, total: scenes.length });
    setSceneImages(scenes.map(() => ({ status: 'loading' })));

    for (let index = 0; index < scenes.length; index += 1) {
      try {
        const res = await fetch(`${API_BASE_URL}/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: scenes[index].image_prompt }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.detail || 'Image request failed');
        }

        const data = await res.json();
        const dataUrl = `data:${data.mime_type};base64,${data.image_base64}`;

        setSceneImages((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index ? { status: 'done', dataUrl } : item,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setSceneImages((prev) =>
          prev.map((item, itemIndex) =>
            itemIndex === index ? { status: 'error', error: message } : item,
          ),
        );
      } finally {
        setImageProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      }
    }
  };

  const generateStory = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setStory(null);
    setSceneImages([]);
    setImageProgress({ done: 0, total: 0 });

    try {
      const res = await fetch(`${API_BASE_URL}/generate-story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || 'Request failed');
      }

      const data = await res.json();
      setStory(data);
      await generateImages(data.scenes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to generate story: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <h1>Gemini Multimodal Storyteller</h1>
        <p>
          Enter a story idea or educational topic. The app returns interleaved scene narration and
          image prompts for each panel.
        </p>

        <div className="controls">
          <textarea
            placeholder="A dragon learning to code"
            value={prompt}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)}
          />

          <div className="actions">
            <button className="btn primary" onClick={generateStory} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Story'}
            </button>
            <button className="btn secondary" onClick={() => setPrompt(starterPrompt)} disabled={loading}>
              Use Demo Prompt
            </button>
          </div>
        </div>

        {loading && imageProgress.total === 0 && (
          <p className="status">Gemini is drafting scenes and visual prompts...</p>
        )}
        {loading && imageProgress.total > 0 && (
          <p className="status">
            Rendering scene images... {imageProgress.done}/{imageProgress.total}
          </p>
        )}
        {error && <p className="status error">{error}</p>}
      </section>

      {story && (
        <section className="story">
          <h2>{story.title}</h2>

          {story.scenes.map((scene, index) => (
            <article key={`${scene.narration}-${index}`} className="scene">
              <div className="scene-label">Scene {index + 1}</div>
              <p>{scene.narration}</p>

              <div className="image-panel">
                <strong>Illustration Prompt</strong>
                <p>{scene.image_prompt}</p>
                {sceneImages[index]?.status === 'done' && sceneImages[index].dataUrl ? (
                  <img
                    className="scene-image"
                    src={sceneImages[index].dataUrl}
                    alt={`Generated illustration for scene ${index + 1}`}
                  />
                ) : (
                  <div className="image-placeholder">
                    {sceneImages[index]?.status === 'error'
                      ? `Image failed: ${sceneImages[index].error}`
                      : 'Generating image...'}
                  </div>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}