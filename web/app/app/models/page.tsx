"use client";

import { useEffect, useState } from "react";
import { Image, Mic, Maximize, Sparkles, Video } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ModelInfo {
  key: string;
  name: string;
  description: string;
}

interface ModelsData {
  image?: ModelInfo[];
  video?: ModelInfo[];
  upscale?: ModelInfo[];
  audio?: ModelInfo[];
}

export default function ModelsPage() {
  const [models, setModels] = useState<ModelsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : { image: [], video: [], upscale: [], audio: [] }))
      .then((data: ModelsData) => setModels(data))
      .catch(() => setError("Could not load models."));
  }, []);

  const sections: { key: keyof ModelsData; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "image", title: "Image models", icon: Image },
    { key: "video", title: "Video models", icon: Video },
    { key: "upscale", title: "Upscale models", icon: Maximize },
    { key: "audio", title: "Voice models", icon: Mic },
  ];

  return (
    <main className="flex min-h-screen w-full flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Models</h1>
        <p className="text-sm text-muted-foreground">Available AI providers and models configured on the worker.</p>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {models === null ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sections.map((s) => (
            <Card key={s.key}>
              <CardContent className="p-6">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {sections.map(({ key, title, icon: Icon }) => {
            const items = models[key] ?? [];
            return (
              <Card key={key}>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{title}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No models configured.</p>
                  ) : (
                    items.map((m) => (
                      <div key={m.key} className="rounded-md border p-2">
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            Routing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The worker automatically routes each generation to the first configured model in the
            catalogue. The UI never selects the underlying provider — it only chooses the business
            feature (Render, Mood, Video, etc.).
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
