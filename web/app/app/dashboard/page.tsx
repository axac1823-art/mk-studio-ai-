"use client";

// Studio — orchestration des panneaux. Scope MVP : agrégateur IA VERTICAL
// pour architectes / archviz / décorateurs / agents immobiliers — 7
// fonctions métier, une par onglet (Render, Mood, Ext→Int, Plan, Animate,
// Multi-Angle, Upscale). Chaque génération est rattachée à un PROJET
// (sélecteur ci-dessous, création inline) ; la galerie de droite est lue
// depuis la DB (assets du projet) — plus d'historique éphémère.
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatePanel } from "@/components/studio/animate-panel";
import { GenerationControls } from "@/components/studio/generation-controls";
import { ImageFeaturePanel } from "@/components/studio/image-feature-panel";
import { ProjectPicker, type ProjectOption } from "@/components/studio/project-picker";
import { ReferencesPanel, type ReferenceImage } from "@/components/studio/references-panel";
import { ResultPanel, type ResultState } from "@/components/studio/result-panel";
import { SceneDetails } from "@/components/studio/scene-details";
import { SceneTypePicker } from "@/components/studio/scene-type-picker";
import { SettingsAccordion } from "@/components/studio/settings-accordion";
import { UpscalePanel } from "@/components/studio/upscale-panel";
import { UploadDropzone } from "@/components/upload-dropzone";
import {
  computeDisplayCost,
  fetchCostsConfig,
  type CostsConfig,
} from "@/lib/config/action-costs";
import { STUDIO_TABS, type StudioTab } from "@/lib/features";
import {
  ANGLE_PRESETS,
  LIGHTING_PRESETS,
  MATERIAL_PRESETS,
  MOOD_PRESETS,
  MOTION_PRESETS,
  PLAN_RENDER_PRESETS,
  SCENE_TYPE_PRESETS,
  UPSCALE_FACTORS,
  type PresetMeta,
  type UpscaleFactor,
} from "@/lib/presets";
import type { AspectRatio, QualityTier, Resolution } from "@/lib/ai/types";

const POLL_INTERVAL_MS = 2500;

/** Asset tel que renvoyé par GET /api/assets (galerie du projet actif). */
interface AssetItem {
  id: string;
  type: "image" | "video";
  url: string;
  isFavorite: boolean;
}

type RightView = "compare" | "gallery";

/** Fonctions image "simples" (hors Print Render et Animate/Upscale) : même panneau générique,
 *  seuls les presets dédiés changent. */
type SimpleImageTab = Exclude<StudioTab, "print_render" | "animate" | "upscale">;

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

  // --- Crédits + config des coûts (fetchés une fois au chargement) ---
  const [balance, setBalance] = useState<number | null>(null);
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);

  // --- Projet actif + galerie DB de ses assets ---
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetItem[]>([]);

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
  const [endAnimateFile, setEndAnimateFile] = useState<File | null>(null);
  const [endAnimateSource, setEndAnimateSource] = useState<{ kind: "history" | "upload"; previewUrl: string | null }>({
    kind: "upload",
    previewUrl: null,
  });
  const [motionId, setMotionId] = useState(MOTION_PRESETS[0].id);
  const [durationSeconds, setDurationSeconds] = useState<4 | 8>(4);
  const [animateSceneDetails, setAnimateSceneDetails] = useState("");

  // --- Upscale ---
  const [upscaleFile, setUpscaleFile] = useState<File | null>(null);
  const [upscalePreviewUrl, setUpscalePreviewUrl] = useState<string | null>(null);
  const [upscaleAssetId, setUpscaleAssetId] = useState<string | null>(null);
  const [upscaleFactor, setUpscaleFactor] = useState<UpscaleFactor>(UPSCALE_FACTORS[0].id);
  const [upscaleEnhance, setUpscaleEnhance] = useState(false);

  // --- Job courant ---
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = result.status === "busy";

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const refreshBalance = useCallback(() => {
    fetch("/api/credits/balance")
      .then((res) => res.json())
      .then((data) => setBalance(typeof data.balance === "number" ? data.balance : null))
      .catch(() => setBalance(null));
  }, []);

  const refreshProjects = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      setProjects(
        (data.projects ?? []).map((project: { id: string; name: string }) => ({
          id: project.id,
          name: project.name,
        }))
      );
      return typeof data.defaultProjectId === "string" ? data.defaultProjectId : null;
    } catch {
      return null;
    }
  }, []);

  const refreshAssets = useCallback((projectId: string | null) => {
    if (!projectId) return;
    fetch(`/api/assets?project_id=${projectId}`)
      .then((res) => res.json())
      .then((data) => setAssets(Array.isArray(data.assets) ? data.assets : []))
      .catch(() => setAssets([]));
  }, []);

  // Chargement initial : solde, coûts, projets (le projet par défaut est
  // présélectionné — la galerie suit via l'effet ci-dessous).
  useEffect(() => {
    refreshBalance();
    fetchCostsConfig()
      .then(setCostsConfig)
      .catch(() => setCostsConfig(null));
    void refreshProjects().then((defaultId) => {
      if (defaultId) setSelectedProjectId((current) => current ?? defaultId);
    });
  }, [refreshBalance, refreshProjects]);

  // La galerie suit le projet sélectionné.
  useEffect(() => {
    refreshAssets(selectedProjectId);
  }, [selectedProjectId, refreshAssets]);

  // Upscale : pré-sélectionne le premier asset image du projet (ou le premier
  // asset si aucune image) quand aucune source n'est choisie — mais on ne
  // remplace jamais une source active (upload ou asset sélectionné).
  useEffect(() => {
    if (upscaleFile || upscaleAssetId) return;
    const firstImage = assets.find((asset) => asset.type === "image");
    setUpscaleAssetId(firstImage?.id ?? assets[0]?.id ?? null);
  }, [assets, upscaleAssetId, upscaleFile]);

  const handleCreateProject = useCallback(
    async (name: string) => {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      await refreshProjects();
      setSelectedProjectId(data.project.id);
    },
    [refreshProjects]
  );

  const pollJob = useCallback(
    (jobId: string, kind: "image" | "video", beforeUrl: string | null) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/generate/${jobId}`);
          const data = await res.json();
          if (data.status === "done") {
            stopPolling();
            const outputUrls: string[] = data.outputUrls ?? [];
            setResult({ status: "done", kind: data.kind ?? kind, beforeUrl, outputUrls });
            // Débit réel au succès + nouvel asset : on rafraîchit les deux.
            refreshBalance();
            setSelectedProjectId((current) => {
              refreshAssets(current);
              return current;
            });
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
    [stopPolling, refreshAssets, refreshBalance]
  );

  const submitGeneration = async (form: FormData, kind: "image" | "video", beforeUrl: string | null) => {
    setError(null);
    setResult({ status: "busy" });
    setRightView("compare");
    if (selectedProjectId) form.append("projectId", selectedProjectId);
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
      pollJob(data.jobId, kind, beforeUrl);
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
    void submitGeneration(form, "image", previewUrl);
  };

  const handleGenerateSimpleImage = () => {
    if (tab === "print_render" || tab === "animate" || tab === "upscale") return;
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
    void submitGeneration(form, "image", state.previewUrl);
  };

  const handleGenerateVideo = () => {
    const form = new FormData();
    form.append("feature", "animate");
    if (animateSource.kind === "upload" && animateFile) {
      form.append("image", animateFile);
    } else if (animateSource.kind === "history" && animateSource.previewUrl) {
      // Rendu précédent (URL du storage worker) : transmis tel quel, le
      // worker le forwarde au pipeline — pas de re-upload nécessaire.
      form.append("imageUrl", animateSource.previewUrl);
    } else {
      return;
    }
    if (endAnimateSource.kind === "upload" && endAnimateFile) {
      form.append("endImage", endAnimateFile);
    } else if (endAnimateSource.kind === "history" && endAnimateSource.previewUrl) {
      form.append("endImageUrl", endAnimateSource.previewUrl);
    }
    form.append("motionId", motionId);
    form.append("durationSeconds", String(durationSeconds));
    form.append("sceneDetails", animateSceneDetails);
    form.append("quality", quality);
    form.append("aspectRatio", aspectRatio);
    form.append("resolution", "1K");
    form.append("quantity", "1");
    void submitGeneration(form, "video", animateSource.previewUrl);
  };

  const handleUpscale = async () => {
    if (!upscaleFile && !upscaleAssetId) return;
    setError(null);
    setResult({ status: "busy" });
    setRightView("compare");
    try {
      const form = new FormData();
      form.append("feature", "upscale");
      if (upscaleFile) form.append("image", upscaleFile);
      if (upscaleAssetId) form.append("assetId", upscaleAssetId);
      form.append("factor", String(upscaleFactor));
      form.append("enhance", upscaleEnhance ? "1" : "0");
      if (selectedProjectId) form.append("projectId", selectedProjectId);
      const res = await fetch("/api/upscale", { method: "POST", body: form });
      const data = await res.json();
      if (res.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setResult({ status: "idle" });
        setError("You don't have enough credits for this upscale.");
        return;
      }
      if (!res.ok) {
        setResult({ status: "idle" });
        setError(data.error ?? "Upscale failed, please try again.");
        return;
      }
      const selectedAsset = assets.find((asset) => asset.id === upscaleAssetId);
      pollJob(data.jobId, "image", upscalePreviewUrl ?? selectedAsset?.url ?? null);
    } catch {
      setResult({ status: "idle" });
      setError("Network error — please try again.");
    }
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

  const latestImageUrl = assets.find((asset) => asset.type === "image")?.url ?? null;

  // Coût et état du bouton pour la fonction image active (Render compris) —
  // la config des coûts est fetchée une fois (affiché = facturé côté serveur).
  const activeImageCost =
    !costsConfig || tab === "animate"
      ? 0
      : computeDisplayCost(costsConfig, { feature: tab, quality, resolution, quantity });
  const activeImageFile =
    tab === "print_render" ? file : tab === "animate" || tab === "upscale" ? null : simpleTabs[tab].file;

  const animateCost = costsConfig
    ? computeDisplayCost(costsConfig, {
        feature: "animate",
        quality,
        resolution: "1K",
        quantity: 1,
        durationSeconds,
      })
    : 0;

  const upscaleCost = costsConfig
    ? computeDisplayCost(costsConfig, { feature: "upscale", quality, resolution: "1K", quantity: 1, upscaleFactor })
    : 0;

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
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Project</span>
            <ProjectPicker
              projects={projects}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              onCreateProject={handleCreateProject}
            />
          </div>

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
                  endSource={endAnimateSource}
                  hasHistoryImages={latestImageUrl !== null}
                  onPickFromHistory={() => {
                    if (latestImageUrl) setAnimateSource({ kind: "history", previewUrl: latestImageUrl });
                  }}
                  onPickEndFromHistory={() => {
                    if (latestImageUrl) setEndAnimateSource({ kind: "history", previewUrl: latestImageUrl });
                  }}
                  onFileSelected={(selected) => {
                    setAnimateFile(selected);
                    setAnimateSource({ kind: "upload", previewUrl: URL.createObjectURL(selected) });
                    setError(null);
                  }}
                  onEndFileSelected={(selected) => {
                    setEndAnimateFile(selected);
                    setEndAnimateSource({ kind: "upload", previewUrl: URL.createObjectURL(selected) });
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
              ) : tab === "upscale" ? (
                <UpscalePanel
                  assets={assets}
                  uploadFile={upscaleFile}
                  uploadPreviewUrl={upscalePreviewUrl}
                  selectedAssetId={upscaleAssetId}
                  factor={upscaleFactor}
                  enhance={upscaleEnhance}
                  cost={upscaleCost}
                  balance={balance}
                  isBusy={isBusy}
                  onUploadFileSelected={(file, previewUrl) => {
                    setUpscaleFile(file);
                    setUpscalePreviewUrl(previewUrl);
                    setUpscaleAssetId(null);
                    setError(null);
                  }}
                  onClearUpload={() => {
                    setUpscaleFile(null);
                    setUpscalePreviewUrl(null);
                    const firstImage = assets.find((asset) => asset.type === "image");
                    setUpscaleAssetId(firstImage?.id ?? assets[0]?.id ?? null);
                  }}
                  onSelectAsset={(id) => {
                    setUpscaleAssetId(id);
                    setUpscaleFile(null);
                    setUpscalePreviewUrl(null);
                    setError(null);
                  }}
                  onFactorChange={setUpscaleFactor}
                  onEnhanceChange={setUpscaleEnhance}
                  onGenerate={handleUpscale}
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
                <CardDescription>Assets of the selected project.</CardDescription>
              </CardHeader>
              <CardContent>
                {assets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing generated yet.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {assets.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => {
                          setResult({
                            status: "done",
                            kind: asset.type,
                            beforeUrl: null,
                            outputUrls: [asset.url],
                          });
                          setRightView("compare");
                        }}
                        className="group rounded-lg border p-1.5 text-left transition-colors hover:border-primary/60"
                      >
                        {asset.type === "video" ? (
                          <video
                            src={asset.url}
                            muted
                            className="aspect-[4/3] w-full rounded-md object-cover"
                          />
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={asset.url}
                            alt="Generated asset"
                            className="aspect-[4/3] w-full rounded-md object-cover"
                          />
                        )}
                        <span className="mt-1 block px-0.5 text-xs capitalize text-muted-foreground">
                          {asset.type}
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

      {tab !== "animate" && tab !== "upscale" && (
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
