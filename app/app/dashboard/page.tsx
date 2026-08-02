"use client";

// Studio — orchestration des panneaux. Scope MVP : agrégateur IA VERTICAL
// pour architectes / archviz / décorateurs / agents immobiliers — 6
// fonctions métier, une par onglet, TOUTES câblées (les fonctions image
// partagent le même pipeline, seul le prompt change). L'utilisateur ne
// voit qu'UN bouton Generate par fonctionnalité : routage et fallback des
// modèles ont lieu côté serveur (aucun sélecteur de modèle exposé en V1).
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePanel } from "@/components/studio/animate-panel";
import { GenerationControls } from "@/components/studio/generation-controls";
import { ImageFeaturePanel } from "@/components/studio/image-feature-panel";
import { ReferencesPanel, type ReferenceImage } from "@/components/studio/references-panel";
import { ResultPanel, type ResultState } from "@/components/studio/result-panel";
import { SceneDetails } from "@/components/studio/scene-details";
import { SceneTypePicker } from "@/components/studio/scene-type-picker";
import { SettingsAccordion } from "@/components/studio/settings-accordion";
import { UploadDropzone } from "@/components/upload-dropzone";
import { computeCreditCost } from "@/lib/costs";
import { FEATURES, STUDIO_TABS, type StudioTab } from "@/lib/features";
import {
  ANGLE_PRESETS,
  LIGHTING_PRESETS,
  MATERIAL_PRESETS,
  MOOD_PRESETS,
  MOTION_PRESETS,
  PLAN_RENDER_PRESETS,
  SCENE_TYPE_PRESETS,
  type PresetMeta,
} from "@/lib/presets";
import type { AspectRatio, QualityTier, Resolution } from "@/lib/ai/types";

const POLL_INTERVAL_MS = 2500;

interface HistoryEntry {
  id: string;
  kind: "image" | "video";
  beforeUrl: string | null;
  outputUrls: string[];
  featureName: string;
}

type RightView = "compare" | "gallery";

/** Fonctions image "simples" (hors Print Render) : même panneau générique,
 *  seuls les presets dédiés changent. */
type SimpleImageTab = Exclude<StudioTab, "print_render" | "animate">;

interface SimpleImageState {
  file: File | null;
  previewUrl: string | null;
  optionId: string;
  sceneDetails: string;
}

const SIMPLE_TAB_CONFIG: Record<SimpleImageTab, { options?: PresetMeta[]; optionsLabel?: string }> = {
  mood_swap: { options: MOOD_PRESETS, optionsLabel: "Atmosphere" },
  exterior_to_interior: {},
  plan_to_render: { options: PLAN_RENDER_PRESETS, optionsLabel: "Render style" },
  multi_angle: { options: ANGLE_PRESETS, optionsLabel: "Camera angle" },
};

function initialSimpleState(optionId: string): SimpleImageState {
  return { file: null, previewUrl: null, optionId, sceneDetails: "" };
}

export default function DashboardPage() {
  // --- Navigation ---
  const [tab, setTab] = useState<StudioTab>("print_render");
  const [rightView, setRightView] = useState<RightView>("compare");

  // --- Crédits (stub côté serveur jusqu'au jalon DB) ---
  const [balance, setBalance] = useState<number | null>(null);

  // --- Print Render ---
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [sceneTypeId, setSceneTypeId] = useState(SCENE_TYPE_PRESETS[0].id);
  const [materialId, setMaterialId] = useState(MATERIAL_PRESETS[0].id);
  const [lightingId, setLightingId] = useState(LIGHTING_PRESETS[0].id);
  const [sceneDetails, setSceneDetails] = useState("");

  // --- Fonctions image simples (Mood, Ext->Int, Plan, Multi-Angle) ---
  const [simpleTabs, setSimpleTabs] = useState<Record<SimpleImageTab, SimpleImageState>>({
    mood_swap: initialSimpleState(MOOD_PRESETS[0].id),
    exterior_to_interior: initialSimpleState(""),
    plan_to_render: initialSimpleState(PLAN_RENDER_PRESETS[0].id),
    multi_angle: initialSimpleState(ANGLE_PRESETS[0].id),
  });

  // --- Contrôles de génération (partagés par toutes les fonctions image) ---
  const [quantity, setQuantity] = useState(1);
  const [quality, setQuality] = useState<QualityTier>("standard");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:3");
  const [resolution, setResolution] = useState<Resolution>("1K");

  // --- Animate ---
  const [animateFile, setAnimateFile] = useState<File | null>(null);
  const [animateSource, setAnimateSource] = useState<{ kind: "history" | "upload"; previewUrl: string | null }>({
    kind: "upload",
    previewUrl: null,
  });
  const [motionId, setMotionId] = useState(MOTION_PRESETS[0].id);
  const [durationSeconds, setDurationSeconds] = useState<4 | 8>(4);
  const [animateSceneDetails, setAnimateSceneDetails] = useState("");

  // --- Job courant + historique de session ---
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = result.status === "busy";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  useEffect(() => {
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  const pollJob = useCallback(
    (jobId: string, kind: "image" | "video", beforeUrl: string | null, featureName: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/generate/${jobId}`);
          const data = await res.json();
          if (data.status === "done") {
            stopPolling();
            const outputUrls: string[] = data.outputUrls ?? [];
            setResult({ status: "done", kind: data.kind ?? kind, beforeUrl, outputUrls });
            setHistory((entries) => [
              { id: jobId, kind: data.kind ?? kind, beforeUrl, outputUrls, featureName },
              ...entries,
            ]);
            setRightView("compare");
          } else if (data.status === "error") {
            stopPolling();
            setResult({ status: "idle" });
            setError(data.error ?? "Generation failed, please try again.");
          } else {
            setResult((current) =>
              current.status === "busy" ? { ...current, stage: data.stage } : current
            );
          }
        } catch {
          // Erreur réseau transitoire : on retente au prochain tick.
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling]
  );

  const submitGeneration = async (
    form: FormData,
    kind: "image" | "video",
    beforeUrl: string | null,
    featureName: string
  ) => {
    setError(null);
    setResult({ status: "busy" });
    setRightView("compare");
    try {
      const res = await fetch("/api/generate", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setResult({ status: "idle" });
        setError("You don't have enough credits for this generation.");
        return;
      }
      if (!res.ok) {
        setResult({ status: "idle" });
        setError(data.error ?? "Generation failed, please try again.");
        return;
      }
      pollJob(data.jobId, kind, beforeUrl, featureName);
    } catch {
      setResult({ status: "idle" });
      setError("Network error — please try again.");
    }
  };

  const updateSimpleTab = (id: SimpleImageTab, patch: Partial<SimpleImageState>) =>
    setSimpleTabs((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const appendSharedSettings = (form: FormData) => {
    form.append("quality", quality);
    form.append("aspectRatio", aspectRatio);
    form.append("resolution", resolution);
    form.append("quantity", String(quantity));
  };

  const handleGenerateRender = () => {
    if (!file) return;
    const form = new FormData();
    form.append("feature", "print_render");
    form.append("image", file);
    for (const reference of references) form.append("reference", reference.file);
    form.append("sceneTypeId", sceneTypeId);
    form.append("materialId", materialId);
    form.append("lightingId", lightingId);
    form.append("sceneDetails", sceneDetails);
    appendSharedSettings(form);
    void submitGeneration(form, "image", previewUrl, FEATURES.print_render.name);
  };

  const handleGenerateSimpleImage = () => {
    if (tab === "print_render" || tab === "animate") return;
    const state = simpleTabs[tab];
    if (!state.file) return;
    const form = new FormData();
    form.append("feature", tab);
    form.append("image", state.file);
    if (SIMPLE_TAB_CONFIG[tab].options && state.optionId) {
      form.append("optionId", state.optionId);
    }
    form.append("sceneDetails", state.sceneDetails);
    appendSharedSettings(form);
    void submitGeneration(form, "image", state.previewUrl, FEATURES[tab].name);
  };

  const handleGenerateVideo = () => {
    const form = new FormData();
    form.append("feature", "animate");
    if (animateSource.kind === "upload" && animateFile) {
      form.append("image", animateFile);
    } else if (animateSource.kind === "history" && animateSource.previewUrl) {
      // Rendu précédent (URL CDN) : transmis tel quel, le serveur le
      // forwarde au pipeline — pas de re-upload nécessaire.
      form.append("imageUrl", animateSource.previewUrl);
    } else {
      return;
    }
    form.append("motionId", motionId);
    form.append("durationSeconds", String(durationSeconds));
    form.append("sceneDetails", animateSceneDetails);
    form.append("quality", quality);
    form.append("aspectRatio", aspectRatio);
    form.append("resolution", "1K");
    form.append("quantity", "1");
    void submitGeneration(form, "video", animateSource.previewUrl, FEATURES.animate.name);
  };

  const handleAddReferences = (files: File[]) => {
    setReferences((current) => [
      ...current,
      ...files.map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
      })),
    ]);
  };

  const latestImageUrl = history.find((entry) => entry.kind === "image")?.outputUrls[0] ?? null;

  // Coût et état du bouton pour la fonction image active (Render compris).
  const activeImageCost =
    tab === "animate" ? 0 : computeCreditCost({ feature: tab, quality, resolution, quantity });
  const activeImageFile = tab === "print_render" ? file : tab === "animate" ? null : simpleTabs[tab].file;

  const animateCost = computeCreditCost({
    feature: "animate",
    quality,
    resolution: "1K",
    quantity: 1,
    durationSeconds,
  });

  return (
    <main className="flex min-h-screen w-full flex-col gap-5 p-4 pb-0 sm:p-6 sm:pb-0">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">RenderStudio</h1>
          <p className="text-sm text-muted-foreground">
            AI renders for architecture, archviz &amp; real estate.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1">
          {balance === null ? "…" : balance} credits
        </Badge>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as StudioTab)}>
        <TabsList>
          {STUDIO_TABS.map((studioTab) => (
            <TabsTrigger key={studioTab.id} value={studioTab.id}>
              {studioTab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid flex-1 gap-6 lg:grid-cols-[400px_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-4 p-4">
              {tab === "print_render" ? (
                <>
                  <UploadDropzone
                    previewUrl={previewUrl}
                    onFileSelected={(selected) => {
                      setFile(selected);
                      setPreviewUrl(URL.createObjectURL(selected));
                      setError(null);
                    }}
                  />
                  <SceneTypePicker value={sceneTypeId} onChange={setSceneTypeId} />
                  <ReferencesPanel
                    references={references}
                    onAdd={handleAddReferences}
                    onRemove={(id) => setReferences((current) => current.filter((ref) => ref.id !== id))}
                  />
                  <SettingsAccordion
                    materialId={materialId}
                    lightingId={lightingId}
                    onMaterialChange={setMaterialId}
                    onLightingChange={setLightingId}
                  />
                  <SceneDetails value={sceneDetails} onChange={setSceneDetails} />
                </>
              ) : tab === "animate" ? (
                <AnimatePanel
                  source={animateSource}
                  hasHistoryImages={latestImageUrl !== null}
                  onPickFromHistory={() => {
                    if (latestImageUrl) setAnimateSource({ kind: "history", previewUrl: latestImageUrl });
                  }}
                  onFileSelected={(selected) => {
                    setAnimateFile(selected);
                    setAnimateSource({ kind: "upload", previewUrl: URL.createObjectURL(selected) });
                    setError(null);
                  }}
                  motionId={motionId}
                  onMotionChange={setMotionId}
                  durationSeconds={durationSeconds}
                  onDurationChange={setDurationSeconds}
                  sceneDetails={animateSceneDetails}
                  onSceneDetailsChange={setAnimateSceneDetails}
                  cost={animateCost}
                  balance={balance}
                  isBusy={isBusy}
                  onGenerate={handleGenerateVideo}
                />
              ) : (
                <ImageFeaturePanel
                  previewUrl={simpleTabs[tab].previewUrl}
                  onFileSelected={(selected) => {
                    updateSimpleTab(tab, {
                      file: selected,
                      previewUrl: URL.createObjectURL(selected),
                    });
                    setError(null);
                  }}
                  options={SIMPLE_TAB_CONFIG[tab].options}
                  optionsLabel={SIMPLE_TAB_CONFIG[tab].optionsLabel}
                  optionId={simpleTabs[tab].optionId}
                  onOptionChange={(id) => updateSimpleTab(tab, { optionId: id })}
                  sceneDetails={simpleTabs[tab].sceneDetails}
                  onSceneDetailsChange={(value) => updateSimpleTab(tab, { sceneDetails: value })}
                />
              )}

              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 pb-6">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant={rightView === "compare" ? "default" : "outline"}
              size="sm"
              onClick={() => setRightView("compare")}
            >
              Result
            </Button>
            <Button
              type="button"
              variant={rightView === "gallery" ? "default" : "outline"}
              size="sm"
              onClick={() => setRightView("gallery")}
            >
              Results
            </Button>
          </div>

          {rightView === "compare" ? (
            <ResultPanel result={result} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription>
                  Session history — kept in your browser only, accounts come next.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing generated yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {history.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => {
                          setResult({
                            status: "done",
                            kind: entry.kind,
                            beforeUrl: entry.beforeUrl,
                            outputUrls: entry.outputUrls,
                          });
                          setRightView("compare");
                        }}
                        className="group rounded-lg border p-1.5 text-left transition-colors hover:border-primary/60"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.outputUrls[0]}
                          alt={entry.featureName}
                          className="aspect-[4/3] w-full rounded-md object-cover"
                        />
                        <span className="mt-1 block px-0.5 text-xs text-muted-foreground">
                          {entry.featureName}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {tab !== "animate" && (
        <GenerationControls
          quantity={quantity}
          quality={quality}
          aspectRatio={aspectRatio}
          resolution={resolution}
          cost={activeImageCost}
          balance={balance}
          isBusy={isBusy}
          canGenerate={activeImageFile !== null}
          onQuantityChange={setQuantity}
          onQualityChange={setQuality}
          onAspectRatioChange={setAspectRatio}
          onResolutionChange={setResolution}
          onGenerate={tab === "print_render" ? handleGenerateRender : handleGenerateSimpleImage}
        />
      )}
    </main>
  );
}
