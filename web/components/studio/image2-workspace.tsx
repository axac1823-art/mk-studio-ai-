"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Download,
  FolderOpen,
  Images,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  Heart,
  MessageCircle,
  LayoutGrid,
  Wand2,
  BookOpen,
  Video,
  Mic,
  Box,
  Layers3,
} from "lucide-react";

import type { ModelOption } from "@/components/studio/generation-controls";
import type { ProjectOption } from "@/components/studio/project-picker";
import type { ResultState } from "@/components/studio/result-panel";
import {
  computeDisplayCost,
  fetchCostsConfig,
  type CostsConfig,
} from "@/lib/config/action-costs";
import { generateUuid } from "@/lib/generate-uuid";
import {
  MAX_QUANTITY,
  QUALITY_TIERS,
  RESOLUTIONS,
  SCENE_DETAILS_MAX,
} from "@/lib/presets";
import type { AspectRatio, QualityTier, Resolution } from "@/lib/ai/types";
import { saveResult } from "@/lib/download";
import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 2500;
const MAX_REFERENCE_IMAGES = 14; // Style filters are text presets and do not consume image input slots.
const MAX_REFERENCE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_REFERENCE_SIZE_BYTES = 500 * 1024 * 1024;
const MAX_PROMPT_LENGTH = SCENE_DETAILS_MAX;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const IMAGE2_STYLE_FILTERS = [
  {
    id: "inkprint",
    tag: "#inkprint",
    label: "Ink print",
    category: "Illustration",
    description:
      "Carved ink contours, bold relief-print shapes, limited spot colors and subtle paper grain.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/1988_linocut_on_paper_in_black_and_white_%27Abstract_still_life_2._-_cut_and_printed_by_Dutch_artist_Fons_Heijnsbroek.tif?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:1988_linocut_on_paper_in_black_and_white_%27Abstract_still_life_2._-_cut_and_printed_by_Dutch_artist_Fons_Heijnsbroek.tif",
  },
  {
    id: "oilpainting",
    tag: "#oilpainting",
    label: "Oil painting",
    category: "Illustration",
    description:
      "Layered pigments, visible brushwork, painterly edges and canvas texture.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Van_Gogh_-_Moorlandschaft.jpeg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Van_Gogh_-_Moorlandschaft.jpeg",
  },
  {
    id: "traditional-japan",
    tag: "#traditional-japan",
    label: "Traditional Japan",
    category: "Illustration",
    description:
      "Japanese woodblock-print language, clear contour lines, flat color and deliberate negative space.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/The_Great_Wave_off_Kanagawa_-_wave.jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:The_Great_Wave_off_Kanagawa_-_wave.jpg",
  },
  {
    id: "fantasy",
    tag: "#fantasy",
    label: "Fantasy",
    category: "Illustration",
    description:
      "Atmospheric concept-art treatment, evocative color and painterly depth without inventing new objects.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/%27Night_898%27_fantasy_past_city_by_Midjourney.jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:%27Night_898%27_fantasy_past_city_by_Midjourney.jpg",
  },
  {
    id: "cartoon",
    tag: "#cartoon",
    label: "Cartoon",
    category: "Illustration",
    description:
      "Clean 2D outlines, simplified silhouettes, flat color blocks and restrained cel shading.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Flat_Cartoon_Guy.png?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Flat_Cartoon_Guy.png",
  },
  {
    id: "3d",
    tag: "#3d",
    label: "3D",
    category: "3D",
    description:
      "Dimensional forms, coherent material response, realistic shading and controlled contact shadows.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Architectural_render_(Blender).jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Architectural_render_(Blender).jpg",
  },
  {
    id: "cartoonfun",
    tag: "#cartoonfun",
    label: "Cartoon fun",
    category: "Illustration",
    description:
      "Playful rounded forms, expressive curves, lively color and energetic shape rhythm.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Anthropomorphic_Kazoo_Cartoon_Character_Illustration_2.png?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Anthropomorphic_Kazoo_Cartoon_Character_Illustration_2.png",
  },
  {
    id: "digital-art",
    tag: "#digital-art",
    label: "Digital art",
    category: "Illustration",
    description:
      "Refined digital brushwork, controlled edges, layered color transitions and art-directed detail.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Digital_Art.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Digital_Art.jpg",
  },
  {
    id: "comic",
    tag: "#comic",
    label: "Comic",
    category: "Illustration",
    description:
      "Confident inking, graphic shadows, selective halftone and a clear focal hierarchy.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Krazy_Kat_panel.jpg?width=420",
    sourcePage: "https://commons.wikimedia.org/wiki/File:Krazy_Kat_panel.jpg",
  },
  {
    id: "painting",
    tag: "#painting",
    label: "Painting",
    category: "Illustration",
    description:
      "General fine-art painting treatment with visible strokes and layered pigment, without forcing a specific medium.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Auguste_Renoir,_Picking_Flowers,_1875,_NGA_52205.jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Auguste_Renoir,_Picking_Flowers,_1875,_NGA_52205.jpg",
  },
  {
    id: "dark",
    tag: "#dark",
    label: "Dark",
    category: "Photo",
    description:
      "Low-key tonal treatment, deep shadows, restrained highlights and preserved shadow detail.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Buildings-nighttime.jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Buildings-nighttime.jpg",
  },
  {
    id: "sketch",
    tag: "#sketch",
    label: "Sketch",
    category: "Design",
    description:
      "Graphite-like strokes, varied line weight, construction marks and controlled hatching.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Architectural_Drawing_(recto);_Sketch_of_a_Figure_(verso)_MET_DP803151.jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Architectural_Drawing_(recto);_Sketch_of_a_Figure_(verso)_MET_DP803151.jpg",
  },
  {
    id: "mock",
    tag: "#mock",
    label: "Rough concept",
    category: "Design",
    description:
      "An early, deliberately unfinished concept with loose exploratory strokes, simplified masses and unresolved details.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Sketch_for_an_architectural_magazine_MET_DP806214.jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Sketch_for_an_architectural_magazine_MET_DP806214.jpg",
  },
  {
    id: "2000s-phone",
    tag: "#2000s-phone",
    label: "2000s phone",
    category: "Photo",
    description:
      "Early digital-camera character, limited dynamic range, subtle sensor noise and mild JPEG softness.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Digital_retro_photography_-_0.3_megapixel_camera_app.jpg?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Digital_retro_photography_-_0.3_megapixel_camera_app.jpg",
  },
  {
    id: "cyberpunk",
    tag: "#cyberpunk",
    label: "Cyberpunk",
    category: "Illustration",
    description:
      "Controlled cyan-magenta palette, selective neon-like accents and cinematic contrast.",
    previewUrl:
      "https://commons.wikimedia.org/wiki/Special:FilePath/Cyberpunk_city_created_by_Stable_Diffusion.webp?width=420",
    sourcePage:
      "https://commons.wikimedia.org/wiki/File:Cyberpunk_city_created_by_Stable_Diffusion.webp",
  },
] as const;

const IMAGE2_STYLE_CATEGORIES = [
  "All",
  "Illustration",
  "3D",
  "Design",
  "Photo",
] as const;

type Image2ModelOption = ModelOption & {
  provider?: string;
  maxReferences?: number;
  tiers?: string[];
  resolutions?: string[];
  frameRatios?: string[];
  costPerGeneration?: number;
  service?: string;
};

interface WorkspaceAsset {
  id: string;
  type: "image" | "video";
  url: string;
  isFavorite?: boolean;
  projectId?: string;
  createdAt?: string;
  feature?: string;
  generationId?: string | null;
  generationPrompt?: string | null;
  generationAspectRatio?: string | null;
  generationQuality?: string | null;
  generationResolution?: string | null;
  generationSelectedModel?: string | null;
  generationModelUsed?: string | null;
  generationCreatedAt?: string | null;
}

interface ImageInput {
  id: string;
  tag: string;
  name: string;
  previewUrl: string;
  file?: File;
  assetId?: string;
  sizeBytes: number;
}

interface CreationFeedItem {
  id: string;
  url: string;
  name: string;
  kind: "generated" | "project";
  assetId?: string;
  createdAt?: string;
  feature?: string;
  isFavorite?: boolean;
  generationId?: string | null;
  generationPrompt?: string | null;
  generationAspectRatio?: string | null;
  generationQuality?: string | null;
  generationResolution?: string | null;
  generationSelectedModel?: string | null;
  generationModelUsed?: string | null;
  generationCreatedAt?: string | null;
}

interface CreationFeedGroup {
  id: string;
  generationId: string | null;
  items: CreationFeedItem[];
}

type CreationFeedEntry =
  | { kind: "group"; key: string; item: CreationFeedItem }
  | { kind: "asset"; key: string; item: CreationFeedItem };

interface LastGenerationMeta {
  prompt: string;
  modelLabel: string;
  aspectRatio: Image2AspectRatio;
  quality: QualityTier;
  resolution: Resolution;
  createdAt: string;
}

interface MentionState {
  start: number;
  end: number;
  query: string;
}

type Image2AspectRatio =
  | AspectRatio
  | "auto"
  | "3:2"
  | "2:3"
  | "21:9";

const RATIO_DESCRIPTIONS: Record<Image2AspectRatio, string> = {
  auto: "Automatic",
  "1:1": "Square (1:1)",
  "16:9": "Landscape (16:9)",
  "9:16": "Portrait (9:16)",
  "4:3": "Classic (4:3)",
  "3:4": "Tall (3:4)",
  "3:2": "Photo (3:2)",
  "2:3": "Vertical (2:3)",
  "21:9": "Cinematic (21:9)",
};

// All framing options supported by Image2 frame size prompt generation.
const IMAGE2_ASPECT_RATIOS: readonly Image2AspectRatio[] = [
  "auto",
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "21:9",
];

function providerLabel(provider?: string, model?: ModelOption): string {
  const known: Record<string, string> = {
    bfl: "Black Forest Labs",
    google: "Google",
    openai: "OpenAI",
    magichour: "Magic Hour",
    comfyui: "ComfyUI",
  };
  if (provider && known[provider.toLowerCase()])
    return known[provider.toLowerCase()];
  const text = `${model?.name ?? ""} ${model?.description ?? ""}`.toLowerCase();
  if (/google|gemini|imagen|nano banana/.test(text)) return "Google";
  if (/openai|\bgpt\b/.test(text)) return "OpenAI";
  if (/flux/.test(text)) return "Black Forest Labs";
  if (/seedream/.test(text)) return "Seedream";
  if (/ideogram/.test(text)) return "Ideogram";
  if (/recraft/.test(text)) return "Recraft";
  if (/qwen/.test(text)) return "Qwen";
  if (/grok/.test(text)) return "xAI";
  if (/magic hour/.test(text)) return "Magic Hour";
  return "Provider not specified";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function getMentionAtCursor(
  value: string,
  cursor: number,
): MentionState | null {
  const start = value.lastIndexOf("@", Math.max(0, cursor - 1));
  if (start < 0) return null;
  const characterBefore = value[start - 1];
  if (characterBefore && /[\w]/.test(characterBefore)) return null;
  const query = value.slice(start + 1, cursor);
  if (query.length > 16 || /\s/.test(query)) return null;
  return { start, end: cursor, query };
}

export function Image2Workspace() {
  const searchParams = useSearchParams();
  const preselectedAssetId = searchParams.get("assetId");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const dragDepthRef = useRef(0);
  const modelDialogTitleId = useId();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const nextTagRef = useRef(1);

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [references, setReferences] = useState<ImageInput[]>([]);
  const [selectedStyleFilters, setSelectedStyleFilters] = useState<string[]>(
    [],
  );
  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [styleFilterSearch, setStyleFilterSearch] = useState("");
  const [styleFilterCategory, setStyleFilterCategory] =
    useState<(typeof IMAGE2_STYLE_CATEGORIES)[number]>("All");
  const [styleFilterNotice, setStyleFilterNotice] = useState<string | null>(
    null,
  );
  const [prompt, setPrompt] = useState("");
  const [mention, setMention] = useState<MentionState | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [modelOptions, setModelOptions] = useState<Image2ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [modelStatusFilter, setModelStatusFilter] = useState<
    "all" | "configured" | "unconfigured"
  >("all");
  const [aspectPickerOpen, setAspectPickerOpen] = useState(false);
  const [selectedOutputIndex, setSelectedOutputIndex] = useState(0);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [projectCreateBusy, setProjectCreateBusy] = useState(false);
  const [costsConfig, setCostsConfig] = useState<CostsConfig | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [quality, setQuality] = useState<QualityTier>("standard");
  const [aspectRatio, setAspectRatio] = useState<Image2AspectRatio>("4:3");
  const [resolution, setResolution] = useState<Resolution>("1K");
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [lastGenerationMeta, setLastGenerationMeta] = useState<LastGenerationMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [referenceNotice, setReferenceNotice] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [activeToolTab, setActiveToolTab] = useState("Image");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [promptGuideOpen, setPromptGuideOpen] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [feedTab, setFeedTab] = useState<
    "Creations" | "My templates" | "Academy"
  >("Creations");
  const [feedSearchOpen, setFeedSearchOpen] = useState(false);
  const [feedSearch, setFeedSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [feedFilter, setFeedFilter] = useState<
    "all" | "generated" | "project" | "favorites"
  >("all");
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [feedColumns, setFeedColumns] = useState<2 | 3 | 4>(3);

  const isBusy = result.status === "busy";
  const selectedModelOption =
    modelOptions.find((model) => model.key === selectedModel) ?? null;
  const providers = useMemo(
    () =>
      Array.from(
        new Set(
          modelOptions.map((model) => providerLabel(model.provider, model)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [modelOptions],
  );
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase();
    return modelOptions.filter((model) => {
      const provider = providerLabel(model.provider, model);
      const matchesSearch =
        !query ||
        `${model.name} ${model.description} ${model.key} ${provider}`
          .toLowerCase()
          .includes(query);
      const matchesProvider =
        providerFilter === "all" || provider === providerFilter;
      const matchesStatus =
        modelStatusFilter === "all" ||
        (modelStatusFilter === "configured" && model.configured) ||
        (modelStatusFilter === "unconfigured" && !model.configured);
      return matchesSearch && matchesProvider && matchesStatus;
    });
  }, [modelOptions, modelSearch, providerFilter, modelStatusFilter]);

  const makeObjectUrl = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    objectUrlsRef.current.add(url);
    return url;
  }, []);

  const revokeObjectUrl = useCallback((url: string | null) => {
    if (url && objectUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      objectUrlsRef.current.delete(url);
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      stopPolling();
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    },
    [stopPolling],
  );

  useEffect(() => {
    if (!modelPickerOpen && !stylePickerOpen && !zoomedImage) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      if (modelPickerOpen) modelSearchRef.current?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModelPickerOpen(false);
        setStylePickerOpen(false);
        setZoomedImage(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [modelPickerOpen, stylePickerOpen, zoomedImage]);

  const refreshBalance = useCallback(async () => {
    try {
      const response = await fetch("/api/credits/balance", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("balance unavailable");
      const data = await response.json();
      setBalance(typeof data.balance === "number" ? data.balance : null);
    } catch {
      setBalance(null);
    }
  }, []);

  const refreshProjects = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch("/api/projects", { cache: "no-store" });
      if (!response.ok) throw new Error("projects unavailable");
      const data = await response.json();
      const nextProjects: ProjectOption[] = Array.isArray(data.projects)
        ? data.projects.map((project: { id: string; name: string }) => ({
            id: project.id,
            name: project.name,
          }))
        : [];
      setProjects(nextProjects);
      const defaultId =
        typeof data.defaultProjectId === "string"
          ? data.defaultProjectId
          : (nextProjects[0]?.id ?? null);
      setSelectedProjectId((current) => current ?? defaultId);
      return defaultId;
    } catch {
      setProjects([]);
      return null;
    }
  }, []);

  const refreshAssets = useCallback(async (projectId: string | null) => {
    if (!projectId) {
      setAssets([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/assets?project_id=${encodeURIComponent(projectId)}&type=image`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("assets unavailable");
      const data = await response.json();
      setAssets(
        Array.isArray(data.assets)
          ? data.assets.filter(
              (asset: WorkspaceAsset) => asset.type === "image",
            )
          : [],
      );
    } catch {
      setAssets([]);
    }
  }, []);

  useEffect(() => {
    void refreshBalance();
    void refreshProjects();
    fetchCostsConfig()
      .then(setCostsConfig)
      .catch(() => setCostsConfig(null));
    fetch("/api/models/text_to_image", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Image2ModelOption[]) =>
        setModelOptions(Array.isArray(data) ? data : []),
      )
      .catch(() => setModelOptions([]));
  }, [refreshBalance, refreshProjects]);

  useEffect(() => {
    void refreshAssets(selectedProjectId);
  }, [selectedProjectId, refreshAssets]);

  const addProjectAssetToReferences = useCallback(
    (asset: WorkspaceAsset) => {
      const existing = references.find(
        (reference) => reference.assetId === asset.id,
      );
      if (existing) {
        const tag = existing.tag;
        setReferences((current) =>
          current.filter((reference) => reference.assetId !== asset.id),
        );
        setPrompt((current) =>
          current.replaceAll(tag, "").replace(/[ \t]{2,}/g, " "),
        );
        setMention(null);
        setReferenceNotice(null);
        return;
      }
      if (references.length >= MAX_REFERENCE_IMAGES) {
        setReferenceNotice(
          `You can add up to ${MAX_REFERENCE_IMAGES} images to one generation.`,
        );
        return;
      }
      setReferences((current) => [
        ...current,
        {
          id: generateUuid(),
          tag: `@img${nextTagRef.current++}`,
          name: "Project image",
          previewUrl: asset.url,
          assetId: asset.id,
          sizeBytes: 0,
        },
      ]);
      setReferenceNotice(null);
      setError(null);
    },
    [references],
  );

  useEffect(() => {
    if (!preselectedAssetId) return;
    fetch(`/api/assets/${encodeURIComponent(preselectedAssetId)}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { asset?: WorkspaceAsset } | null) => {
        const asset = data?.asset;
        if (!asset || asset.type !== "image") return;
        setReferences((current) => {
          if (
            current.some((reference) => reference.assetId === asset.id) ||
            current.length >= MAX_REFERENCE_IMAGES
          )
            return current;
          return [
            ...current,
            {
              id: generateUuid(),
              tag: `@img${nextTagRef.current++}`,
              name: "Project image",
              previewUrl: asset.url,
              assetId: asset.id,
              sizeBytes: 0,
            },
          ];
        });
      })
      .catch(() => undefined);
  }, [preselectedAssetId]);

  const addReferenceFiles = useCallback(
    (inputFiles: FileList | File[]) => {
      const incoming = Array.from(inputFiles);
      const valid: File[] = [];
      const invalid: string[] = [];
      for (const file of incoming) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type))
          invalid.push(`${file.name}: use PNG, JPEG or WebP.`);
        else if (file.size === 0 || file.size > MAX_REFERENCE_SIZE_BYTES)
          invalid.push(`${file.name}: each image can be up to 100 MB.`);
        else valid.push(file);
      }

      const remaining = Math.max(0, MAX_REFERENCE_IMAGES - references.length);
      let totalBytes = references.reduce(
        (sum, reference) => sum + reference.sizeBytes,
        0,
      );
      const accepted: File[] = [];
      let aggregateRejected = false;
      for (const file of valid.slice(0, remaining)) {
        if (totalBytes + file.size > MAX_TOTAL_REFERENCE_SIZE_BYTES) {
          aggregateRejected = true;
          continue;
        }
        accepted.push(file);
        totalBytes += file.size;
      }

      const notices = invalid.slice(0, 2);
      if (valid.length > remaining)
        notices.push(
          `You can add up to ${MAX_REFERENCE_IMAGES} images per generation.`,
        );
      if (aggregateRejected)
        notices.push(
          "The combined upload limit is 500 MB. Remove an uploaded image or choose smaller files.",
        );
      setReferenceNotice(notices.length ? notices.join(" ") : null);

      if (accepted.length) {
        const additions = accepted.map((file) => ({
          id: generateUuid(),
          tag: `@img${nextTagRef.current++}`,
          name: file.name,
          file,
          previewUrl: makeObjectUrl(file),
          sizeBytes: file.size,
        }));
        setReferences((current) =>
          [...current, ...additions].slice(0, MAX_REFERENCE_IMAGES),
        );
        setError(null);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [references, makeObjectUrl],
  );

  const removeReference = useCallback(
    (id: string) => {
      const reference = references.find((item) => item.id === id);
      if (reference?.file) revokeObjectUrl(reference.previewUrl);
      if (reference) {
        setPrompt((value) =>
          value.replaceAll(reference.tag, "").replace(/[ \t]{2,}/g, " "),
        );
      }
      setReferences((current) => current.filter((item) => item.id !== id));
      setMention(null);
      setReferenceNotice(null);
    },
    [references, revokeObjectUrl],
  );

  const addTagAtCursor = (tag: string) => {
    const textarea = promptRef.current;
    const start = textarea?.selectionStart ?? prompt.length;
    const end = textarea?.selectionEnd ?? prompt.length;
    const prefix = prompt.slice(0, start);
    const separator = prefix.length > 0 && !/\s$/.test(prefix) ? " " : "";
    const insertion = `${separator}${tag} `;
    const nextPrompt = `${prefix}${insertion}${prompt.slice(end)}`;
    const nextCursor = prefix.length + insertion.length;
    setPrompt(nextPrompt);
    setMention(null);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const selectMention = (input: ImageInput) => {
    if (!mention) return;
    const textarea = promptRef.current;
    const nextPrompt = `${prompt.slice(0, mention.start)}${input.tag} ${prompt.slice(mention.end)}`;
    const nextCursor = mention.start + input.tag.length + 1;
    setPrompt(nextPrompt);
    setMention(null);
    setMentionIndex(0);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const updateMentionFromTextarea = () => {
    const textarea = promptRef.current;
    if (!textarea) return;
    setMention(
      getMentionAtCursor(
        textarea.value,
        textarea.selectionStart ?? textarea.value.length,
      ),
    );
    setMentionIndex(0);
  };

  const mentionOptions = useMemo(() => {
    if (!mention) return [];
    const query = mention.query.toLowerCase();
    return references.filter((reference) =>
      reference.tag.slice(1).toLowerCase().startsWith(query),
    );
  }, [mention, references]);

  const stopAndPollJob = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/generate/${jobId}`, {
            cache: "no-store",
          });
          const data = await response.json();
          if (data.status === "done") {
            stopPolling();
            setResult({
              status: "done",
              kind: data.kind ?? "image",
              beforeUrl: null,
              outputUrls: data.outputUrls ?? [],
            });
            setSelectedOutputIndex(0);
            void refreshBalance();
            void refreshAssets(selectedProjectId);
          } else if (data.status === "error") {
            stopPolling();
            setResult({ status: "idle" });
            setError(data.error ?? "Generation failed. Please try again.");
          } else {
            setResult((current) =>
              current.status === "busy"
                ? { ...current, stage: data.stage }
                : current,
            );
          }
        } catch {
          // Retry at the next interval after a transient network failure.
        }
      }, POLL_INTERVAL_MS);
    },
    [stopPolling, refreshBalance, refreshAssets, selectedProjectId],
  );

  const imageInputCount = references.length;
  const isCompatibleWithSelectedInputs = useCallback(
    (model: Image2ModelOption) =>
      model.configured && imageInputCount <= (model.maxReferences ?? 0),
    [imageInputCount],
  );
  const compatibleConfiguredModels = useMemo(
    () => modelOptions.filter(isCompatibleWithSelectedInputs),
    [modelOptions, isCompatibleWithSelectedInputs],
  );
  // Keep Auto settings consistent with models that support the selected frame.
  const frameCompatibleModels = useMemo(
    () => compatibleConfiguredModels.filter((model) => model.frameRatios?.includes(aspectRatio)),
    [compatibleConfiguredModels, aspectRatio],
  );
  // Show only settings genuinely exposed by the selected model. Auto uses the
  // intersection across configured models that can handle the selected inputs.
  const availableQualityTiers = useMemo(() => {
    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;
    if (capabilityModels.length === 0) return [QUALITY_TIERS[0]];
    const supportedIds = new Set(capabilityModels.flatMap((model) => model.tiers ?? ["standard"]));
    const supported = QUALITY_TIERS.filter((tier) => supportedIds.has(tier.id));
    return supported.length > 0 ? supported : [QUALITY_TIERS[0]];
  }, [selectedModelOption, frameCompatibleModels]);
  const availableResolutions = useMemo<Resolution[]>(() => {
    const capabilityModels = selectedModelOption ? [selectedModelOption] : frameCompatibleModels;
    if (capabilityModels.length === 0) return ["1K"];
    return RESOLUTIONS.filter((value) =>
      capabilityModels.every((model) => (model.resolutions ?? ["1K"]).includes(value)),
    );
  }, [selectedModelOption, frameCompatibleModels]);

  useEffect(() => {
    if (!availableQualityTiers.some((tier) => tier.id === quality)) {
      setQuality(availableQualityTiers[0]?.id ?? "standard");
    }
  }, [availableQualityTiers, quality]);

  useEffect(() => {
    if (!availableResolutions.includes(resolution)) {
      setResolution(availableResolutions[0] ?? "1K");
    }
  }, [availableResolutions, resolution]);
  // Preview the worker's Auto order using the current frame and quality tier.
  const resolvedAutoModel = useMemo<Image2ModelOption | null>(() => {
    if (frameCompatibleModels.length === 0) return null;
    const matchingTier = frameCompatibleModels.filter((model) =>
      (model.tiers ?? ["standard"]).includes(quality),
    );
    const candidates = matchingTier.length > 0 ? matchingTier : frameCompatibleModels;
    return candidates.reduce((best, model) =>
      (model.costPerGeneration ?? Infinity) < (best.costPerGeneration ?? Infinity)
        ? model
        : best,
    );
  }, [frameCompatibleModels, quality]);
  // Auto offers the union of frames from configured compatible models.
  // A missing capability declaration is not treated as support.
  const supportedFrames = useMemo<Set<string> | null>(() => {
    if (modelOptions.length === 0) return null;
    const source = selectedModelOption ? [selectedModelOption] : compatibleConfiguredModels;
    return new Set(source.flatMap((model) => model.frameRatios ?? []));
  }, [modelOptions.length, selectedModelOption, compatibleConfiguredModels]);
  const frameSupported = useCallback(
    (ratio: Image2AspectRatio) => supportedFrames === null || supportedFrames.has(ratio),
    [supportedFrames],
  );
  const selectedModelCanHandleImages = selectedModelOption
    ? isCompatibleWithSelectedInputs(selectedModelOption)
    : !selectedModel;
  const canGenerate =
    prompt.trim().length > 0 &&
    selectedModelCanHandleImages &&
    frameSupported(aspectRatio) &&
    (Boolean(selectedModel) ||
      modelOptions.length === 0 ||
      compatibleConfiguredModels.length > 0);

  const activeCost = costsConfig
    ? computeDisplayCost(costsConfig, {
        feature: "text_to_image",
        quality,
        resolution,
        quantity,
      })
    : 0;
  const hasEnoughCredits =
    !costsConfig || balance === null || balance >= activeCost;
  const selectedOutputUrls = result.status === "done" ? result.outputUrls : [];
  // Durable gallery content comes from /api/assets. The currently selected
  // result is rendered in its dedicated "Just created" group above; keeping it
  // out of this list prevents duplicate tiles and lets saved groups survive reloads.
  const creationItems = useMemo<CreationFeedItem[]>(() => assets
    .filter((asset) => asset.type === "image")
    .map((asset) => ({
      id: asset.id,
      url: asset.url,
      name: "Project image",
      kind: asset.generationId || asset.feature ? "generated" : "project",
      assetId: asset.id,
      createdAt: asset.createdAt,
      feature: asset.feature,
      isFavorite: asset.isFavorite,
      generationId: asset.generationId ?? null,
      generationPrompt: asset.generationPrompt ?? null,
      generationAspectRatio: asset.generationAspectRatio ?? null,
      generationQuality: asset.generationQuality ?? null,
      generationResolution: asset.generationResolution ?? null,
      generationSelectedModel: asset.generationSelectedModel ?? null,
      generationModelUsed: asset.generationModelUsed ?? null,
      generationCreatedAt: asset.generationCreatedAt ?? null,
    })),
  [assets]);
  const filteredCreationItems = useMemo(() => {
    const query = feedSearch.trim().toLowerCase();
    return creationItems.filter((item) => {
      const matchesQuery =
        !query ||
        `${item.name} ${item.feature ?? ""} ${item.kind}`
          .toLowerCase()
          .includes(query);
      const matchesFilter =
        feedFilter === "all" ||
        (feedFilter === "generated" && item.kind === "generated") ||
        (feedFilter === "project" && item.kind === "project") ||
        (feedFilter === "favorites" && item.isFavorite === true);
      return matchesQuery && matchesFilter;
    });
  }, [creationItems, feedSearch, feedFilter]);

  const creationGroups = useMemo<CreationFeedGroup[]>(() => {
    const groups: CreationFeedGroup[] = [];
    const byKey = new Map<string, CreationFeedGroup>();
    for (const item of filteredCreationItems) {
      const key = item.generationId ? `generation:${item.generationId}` : `asset:${item.id}`;
      let group = byKey.get(key);
      if (!group) {
        group = { id: key, generationId: item.generationId ?? null, items: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.items.push(item);
    }
    return groups;
  }, [filteredCreationItems]);

  const creationFeedEntries = useMemo<CreationFeedEntry[]>(() => {
    const entries: CreationFeedEntry[] = [];
    for (const group of creationGroups) {
      if (group.generationId && group.items[0]) {
        entries.push({ kind: "group", key: `group:${group.id}`, item: group.items[0] });
      }
      for (const item of group.items) {
        entries.push({ kind: "asset", key: `asset:${item.id}`, item });
      }
    }
    return entries;
  }, [creationGroups]);
  const selectedUploadBytes = references.reduce(
    (sum, reference) => sum + reference.sizeBytes,
    0,
  );

  const handleModelSelection = (key: string) => {
    setSelectedModel(key);
    setModelPickerOpen(false);
  };

  const toggleStyleFilter = (filterId: string) => {
    if (selectedStyleFilters.includes(filterId)) {
      setSelectedStyleFilters((current) =>
        current.filter((id) => id !== filterId),
      );
      setStyleFilterNotice(null);
      return;
    }
    if (selectedStyleFilters.length >= 3) {
      setStyleFilterNotice("Choose up to 3 style filters at a time.");
      return;
    }
    setSelectedStyleFilters((current) => [...current, filterId]);
    setStyleFilterNotice(null);
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isBusy) return;

    if (selectedModelOption && !selectedModelOption.configured) {
      setError(
        "The selected model is not configured on the worker. Choose another model or Auto.",
      );
      return;
    }
    if (
      selectedModelOption &&
      imageInputCount > (selectedModelOption.maxReferences ?? 0)
    ) {
      setError(
        `${selectedModelOption.name} supports up to ${selectedModelOption.maxReferences ?? 0} total image inputs including Style. Choose a compatible model or remove images.`,
      );
      return;
    }

    if (!frameSupported(aspectRatio)) {
      const supported = Array.from(supportedFrames ?? []).join(", ") || "none";
      setError(
        `No compatible configured model can generate ${aspectRatio} natively. Supported frames: ${supported}.`,
      );
      return;
    }
    setError(null);
    setLastGenerationMeta({
      prompt: prompt.trim(),
      modelLabel: selectedModelOption?.name ?? (resolvedAutoModel ? `Auto · ${resolvedAutoModel.name}` : "Auto"),
      aspectRatio,
      quality,
      resolution,
      createdAt: new Date().toISOString(),
    });
    setResult({ status: "busy" });
    const form = new FormData();
    form.append("feature", "text_to_image");
    form.append("sceneDetails", prompt.trim());
    form.append("quality", quality);
    form.append("aspectRatio", aspectRatio);
    form.append("resolution", resolution);
    form.append("quantity", String(quantity));
    if (selectedProjectId) form.append("projectId", selectedProjectId);
    if (selectedModel) form.append("model", selectedModel);

    references.forEach((reference, index) => {
      form.append(
        "referenceMeta",
        JSON.stringify({
          index,
          source: reference.file ? "upload" : "asset",
          assetId: reference.assetId,
          tag: reference.tag,
        }),
      );
      if (reference.file) form.append(`referenceFile_${index}`, reference.file);
    });
    selectedStyleFilters.forEach((filterId) =>
      form.append("styleFilter", filterId),
    );

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (response.status === 402) {
        setBalance(typeof data.balance === "number" ? data.balance : balance);
        setResult({ status: "idle" });
        setError(
          `Not enough credits. This generation needs ${data.required ?? "additional"} credits; your balance is ${data.balance ?? balance ?? "unknown"}.`,
        );
        return;
      }
      if (!response.ok) {
        setResult({ status: "idle" });
        setError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      stopAndPollJob(data.jobId);
    } catch {
      setResult({ status: "idle" });
      setError("Network error. Please check your connection and try again.");
    }
  }, [
    prompt,
    isBusy,
    selectedModelOption,
    resolvedAutoModel,
    frameSupported,
    supportedFrames,
    references,
    selectedStyleFilters,
    imageInputCount,
    quality,
    aspectRatio,
    resolution,
    quantity,
    selectedProjectId,
    selectedModel,
    balance,
    stopAndPollJob,
  ]);

  const handleCreateProject = useCallback(
    async (name: string) => {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error ?? "Could not create project.");
      await refreshProjects();
      setSelectedProjectId(data.project.id);
    },
    [refreshProjects],
  );

  const handleCreateProjectInline = async () => {
    const name = projectDraft.trim();
    if (!name || projectCreateBusy) return;
    setProjectCreateBusy(true);
    try {
      await handleCreateProject(name);
      setProjectDraft("");
      setProjectCreateOpen(false);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create project.",
      );
    } finally {
      setProjectCreateBusy(false);
    }
  };

  const clearReferences = () => {
    references.forEach((reference) => {
      if (reference.file) revokeObjectUrl(reference.previewUrl);
    });
    const oldTags = references.map((reference) => reference.tag);
    setPrompt((value) =>
      oldTags
        .reduce((next, tag) => next.replaceAll(tag, ""), value)
        .replace(/[ \t]{2,}/g, " "),
    );
    setReferences([]);
    setReferenceNotice(null);
    setMention(null);
    nextTagRef.current = 1;
  };

  const modelButtonText = selectedModelOption
    ? selectedModelOption.name
    : resolvedAutoModel
      ? `Auto · ${resolvedAutoModel.name}`
      : "Auto (recommended)";

  return (
    <main className="image2-magnific-shell flex h-[calc(100svh-72px)] min-h-[640px] w-full flex-col gap-2 overflow-hidden bg-[#17181b] p-2 text-[#eeeef2] lg:h-[calc(100vh-80px)] md:flex-row">
      <aside
        aria-label="Image generator controls"
        className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-xl bg-[#222328] md:w-80 md:max-h-[calc(100vh-96px)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 [scrollbar-width:thin] [scrollbar-color:#41424a_transparent]">
          <nav
            aria-label="Generator categories"
            className="mb-4 flex items-center gap-1 overflow-x-auto pb-1 [scrollbar-width:none]"
          >
            {[
              { label: "Image", icon: Images, active: true },
              { label: "Video", icon: Video, active: false },
              { label: "Audio", icon: Mic, active: false },
              { label: "Spaces", icon: Box, active: false },
              { label: "Design", icon: Layers3, active: false },
              { label: "3D", icon: Box, active: false },
              { label: "Flows", icon: Wand2, active: false },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => {
                    setActiveToolTab(tab.label);
                    if (tab.label === "Image") setError(null);
                    else
                      setError(
                        `${tab.label} is shown here as a navigation reference; this experimental workspace currently runs Image Generator.`,
                      );
                  }}
                  aria-pressed={activeToolTab === tab.label}
                  className={cn(
                    "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs transition-colors",
                    activeToolTab === tab.label
                      ? "bg-[#35363d] font-semibold text-white"
                      : "text-[#8c8e98] hover:bg-white/[0.045] hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 md:hidden" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="group relative mb-4 flex h-[72px] items-end justify-between overflow-hidden rounded-xl bg-[#2d2d36] px-3 py-2.5">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(151,145,255,0.25),transparent_58%),linear-gradient(125deg,rgba(255,255,255,0.025),transparent_65%)]" />
            <div className="relative z-10 min-w-0">
              <p className="mb-1 flex items-center gap-1 text-xs text-[#9a9ba5]">
                <ChevronDown className="h-3 w-3 rotate-90" /> Tools
              </p>
              <h1 className="truncate text-sm font-medium text-white">
                Image Generator
              </h1>
            </div>
            <div className="relative z-10 flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTemplatesOpen((open) => !open)}
                aria-expanded={templatesOpen}
                className="flex h-9 min-w-[66px] flex-col items-center justify-center gap-1 rounded-lg bg-black/15 px-2 text-[10px] text-[#c8c8d0] transition-colors hover:bg-black/25 hover:text-white"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Templates
              </button>
            </div>
            {templatesOpen && (
              <div className="absolute right-2 top-[76px] z-50 w-[min(270px,calc(100vw-40px))] rounded-xl border border-white/[0.10] bg-[#2c2d33] p-2 shadow-2xl">
                <p className="px-2 pb-2 pt-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#8f919b]">
                  Prompt starters
                </p>
                {[
                  [
                    "Architectural visualization",
                    "Architectural visualization with controlled perspective and coherent material detail. Respect the requested subject; selected style filters control visual treatment.",
                  ],
                  [
                    "Editorial interior",
                    "Editorial interior image with tactile surfaces and deliberate composition. Respect the requested subject; selected style filters control light, palette and mood.",
                  ],
                  [
                    "Product studio",
                    "Precisely rendered product image with accurate silhouette and material detail. Match the requested subject and apply the selected style treatment.",
                  ],
                ].map(([title, template]) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => {
                      setPrompt(template);
                      setTemplatesOpen(false);
                      setPromptGuideOpen(false);
                    }}
                    className="block w-full rounded-lg px-2.5 py-2 text-left text-xs text-[#dedee5] transition-colors hover:bg-white/[0.06]"
                  >
                    <span className="block font-medium">{title}</span>
                    <span className="mt-1 block line-clamp-2 text-[10px] leading-4 text-[#92949f]">
                      {template}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <label className="flex h-6 items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91939e]">
              Model
            </label>
            <span className="text-[9px] text-[#737680]">
              {modelOptions.length} available
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setModelSearch("");
              setProviderFilter("all");
              setModelStatusFilter("all");
              setModelPickerOpen(true);
            }}
            aria-haspopup="dialog"
            aria-expanded={modelPickerOpen}
            className="flex h-8 w-full items-center justify-between gap-2 rounded-lg bg-[#17181c] px-3 text-left text-xs transition-colors hover:bg-[#1c1d22] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#9f9cff]"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#b8b5ff]" />
              <span className="truncate font-medium">{modelButtonText}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-[#999ba5]">
              <span className="hidden max-w-[104px] truncate text-[9px] sm:inline">
                {selectedModelOption
                  ? providerLabel(
                      selectedModelOption.provider,
                      selectedModelOption,
                    )
                  : resolvedAutoModel
                    ? providerLabel(
                        resolvedAutoModel.provider,
                        resolvedAutoModel,
                      )
                    : "Auto-select"}
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
          </button>
          <p className="mt-1.5 text-[9px] leading-4 text-[#737680]">
            {selectedModelOption
              ? `${selectedModelOption.service ?? "Text-to-image"} · up to ${selectedModelOption.maxReferences ?? 0} image inputs`
              : resolvedAutoModel
                ? `Auto will use ${resolvedAutoModel.name} · up to ${resolvedAutoModel.maxReferences ?? 0} image inputs`
                : "Select the AI model and provider used by this service."}
          </p>
          {selectedModelOption &&
            (!selectedModelOption.configured ||
              imageInputCount > (selectedModelOption.maxReferences ?? 0)) && (
              <p
                role="status"
                className="mt-2 rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2 py-1.5 text-[10px] leading-4 text-amber-200"
              >
                {!selectedModelOption.configured
                  ? `${selectedModelOption.name} is not configured on the worker.`
                  : `This model supports ${selectedModelOption.maxReferences ?? 0} content image inputs, but ${imageInputCount} are selected.`}
              </p>
            )}

          <section className="mt-5 space-y-2" aria-label="Style filters">
            <div className="flex h-6 items-center justify-between gap-2">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91939e]">
                Style / Filter
              </h2>
              <span className="text-[9px] tabular-nums text-[#858792]">
                {selectedStyleFilters.length}/3
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStylePickerOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={stylePickerOpen}
              className="group flex min-h-[78px] w-full items-center gap-3 rounded-lg border border-white/[0.10] bg-[#1c1d22] p-2 text-left transition-colors hover:border-[#aaa7ff]/50 hover:bg-[#23242b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a09cff]"
            >
              <span className="grid h-[62px] w-[62px] shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-md bg-[#101114]">
                {selectedStyleFilters.length > 0 ? (
                  selectedStyleFilters.slice(0, 4).map((filterId) => {
                    const filter = IMAGE2_STYLE_FILTERS.find(
                      (item) => item.id === filterId,
                    );
                    return filter ? (
                      <img
                        key={filter.id}
                        src={filter.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : null;
                  })
                ) : (
                  <span className="col-span-2 flex items-center justify-center text-[#aaa7ff]">
                    <Wand2 className="h-5 w-5" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-[#e5e5ec]">
                  {selectedStyleFilters.length
                    ? selectedStyleFilters
                        .map(
                          (id) =>
                            IMAGE2_STYLE_FILTERS.find((item) => item.id === id)
                              ?.tag,
                        )
                        .filter(Boolean)
                        .join(" · ")
                    : "Choose a visual style"}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-[#858893]">
                  Style presets change the visual treatment, not the subject or
                  background.
                </span>
              </span>
              <span className="shrink-0 rounded-md bg-white/[0.06] px-2.5 py-1.5 text-[10px] font-medium text-[#d8d7e2] group-hover:bg-[#aaa7ff]/15 group-hover:text-[#dad8ff]">
                Browse
              </span>
            </button>
            {selectedStyleFilters.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedStyleFilters.map((filterId) => {
                  const filter = IMAGE2_STYLE_FILTERS.find(
                    (item) => item.id === filterId,
                  );
                  return filter ? (
                    <button
                      key={filterId}
                      type="button"
                      onClick={() => toggleStyleFilter(filterId)}
                      title={`Remove ${filter.tag}`}
                      className="inline-flex items-center gap-1 rounded-full border border-[#aaa7ff]/30 bg-[#aaa7ff]/10 px-2 py-1 text-[9px] text-[#d0ceff] hover:bg-[#aaa7ff]/20"
                    >
                      {filter.tag}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ) : null;
                })}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStyleFilters([]);
                    setStyleFilterNotice(null);
                  }}
                  className="rounded-full px-2 py-1 text-[9px] text-[#858893] hover:bg-white/[0.06] hover:text-white"
                >
                  Clear all
                </button>
              </div>
            )}
            {styleFilterNotice && (
              <p
                role="status"
                className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-2 text-[10px] leading-4 text-amber-200"
              >
                {styleFilterNotice}
              </p>
            )}
          </section>

          <section
            className="mt-5 space-y-2"
            aria-label="Image content references"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91939e]">
                  References
                </h2>
                <p className="mt-0.5 text-[9px] text-[#757883]">
                  Use @img1, @img2… in your prompt.
                </p>
              </div>
              <span className="text-[9px] tabular-nums text-[#858792]">
                {references.length}/{MAX_REFERENCE_IMAGES}
              </span>
            </div>
            <div
              onDragEnter={(event) => {
                event.preventDefault();
                dragDepthRef.current += 1;
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
                if (dragDepthRef.current === 0) setIsDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                dragDepthRef.current = 0;
                setIsDragging(false);
                addReferenceFiles(event.dataTransfer.files);
              }}
              className={cn(
                "rounded-lg transition-colors",
                isDragging &&
                  "ring-1 ring-[#9f9cff] ring-offset-2 ring-offset-[#222328]",
              )}
            >
              <div className="grid grid-cols-4 gap-2.5">
                {references.map((reference) => (
                  <div
                    key={reference.id}
                    className="group/reference relative min-w-0"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-white/[0.09] bg-[#17181c] transition-colors group-hover/reference:border-white/[0.20]">
                      <button
                        type="button"
                        onClick={() => setZoomedImage(reference.previewUrl)}
                        aria-label={`Preview ${reference.tag}`}
                        className="absolute inset-0 h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#aaa7ff]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={reference.previewUrl}
                          alt={reference.name}
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => addTagAtCursor(reference.tag)}
                        title={`Mention ${reference.tag} in the prompt`}
                        className="absolute bottom-1 left-1 z-10 rounded bg-black/70 px-1.5 py-1 text-[9px] font-medium text-white backdrop-blur hover:bg-black/90"
                      >
                        {reference.tag}
                      </button>
                      <button
                        type="button"
                        onClick={() => setZoomedImage(reference.previewUrl)}
                        aria-label={`Zoom ${reference.tag}`}
                        className="absolute left-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-black/55 text-white opacity-0 transition-opacity group-hover/reference:opacity-100 focus:opacity-100"
                      >
                        <ZoomIn className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeReference(reference.id)}
                        aria-label={`Remove ${reference.tag}`}
                        title="Remove reference"
                        className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-md bg-black/65 text-white transition-colors hover:bg-rose-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <p
                      className="mt-1 truncate px-0.5 text-[9px] text-[#a6a8b1]"
                      title={reference.name}
                    >
                      {reference.name}
                    </p>
                  </div>
                ))}
                {references.length < MAX_REFERENCE_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/[0.14] bg-[#1b1c20] px-1 text-center transition-colors hover:border-[#a09cff]/65 hover:bg-[#24252b] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#a09cff]",
                      references.length === 0 && "col-span-2 aspect-square",
                    )}
                  >
                    <Plus className="h-4 w-4 text-[#8b8e99] transition-colors group-hover:text-[#c6c3ff]" />
                    <span className="text-[9px] text-[#8d909a]">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) =>
                  addReferenceFiles(event.target.files ?? [])
                }
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] pt-2">
              <p className="text-[9px] leading-4 text-[#727580]">
                PNG · JPEG · WebP · 100 MB / image
              </p>
              {references.length > 0 && (
                <button
                  type="button"
                  onClick={clearReferences}
                  className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-1 text-[9px] text-[#8e919b] hover:bg-white/[0.06] hover:text-white"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            {referenceNotice && (
              <p
                role="status"
                className="rounded-md border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-2 text-[10px] leading-4 text-amber-200"
              >
                {referenceNotice}
              </p>
            )}
            {selectedUploadBytes > 0 && (
              <p className="text-[9px] text-[#70737d]">
                {formatBytes(selectedUploadBytes)} of 500 MB uploaded allowance
                · {imageInputCount}/14 content images
              </p>
            )}
          </section>

          {assets.length > 0 && (
            <section
              className="mt-5 space-y-2 border-t border-white/[0.07] pt-3"
              aria-label="Project image library"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 text-[#8b8e98]" />
                  <h2 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#91939e]">
                    From this project
                  </h2>
                </div>
                <span className="text-[9px] text-[#737680]">
                  Add content references
                </span>
              </div>
            </section>
          )}

          <section className="mt-5 pb-4" aria-label="Image prompt">
            <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
              <label
                htmlFor="image2-prompt"
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91939e]"
              >
                Prompt
              </label>
              <button
                type="button"
                onClick={() => {
                  setPrompt("");
                  setMention(null);
                }}
                disabled={!prompt}
                className="rounded px-1.5 py-1 text-[9px] text-[#858893] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-30"
              >
                Clear
              </button>
            </div>
            <div className="group/prompt relative flex flex-col rounded-lg border border-white/[0.12] bg-[#1c1d22] transition-colors focus-within:border-[#9b97ff]">
              <div className="relative flex flex-1 flex-col">
                <textarea
                  ref={promptRef}
                  id="image2-prompt"
                  value={prompt}
                  onChange={(event) => {
                    const value = event.target.value.slice(
                      0,
                      MAX_PROMPT_LENGTH,
                    );
                    setPrompt(value);
                    setMention(
                      getMentionAtCursor(
                        value,
                        event.currentTarget.selectionStart ?? value.length,
                      ),
                    );
                    setMentionIndex(0);
                  }}
                  onClick={updateMentionFromTextarea}
                  onKeyUp={(event) => {
                    if (
                      ![
                        "ArrowUp",
                        "ArrowDown",
                        "Enter",
                        "Tab",
                        "Escape",
                      ].includes(event.key)
                    )
                      updateMentionFromTextarea();
                  }}
                  onKeyDown={(event) => {
                    if (!mention || mentionOptions.length === 0) {
                      if (event.key === "Escape") setMention(null);
                      return;
                    }
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setMentionIndex(
                        (current) => (current + 1) % mentionOptions.length,
                      );
                    } else if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setMentionIndex(
                        (current) =>
                          (current - 1 + mentionOptions.length) %
                          mentionOptions.length,
                      );
                    } else if (event.key === "Enter" || event.key === "Tab") {
                      event.preventDefault();
                      selectMention(mentionOptions[mentionIndex]);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      setMention(null);
                    }
                  }}
                  maxLength={MAX_PROMPT_LENGTH}
                  rows={5}
                  placeholder="Describe your image, try @ for references or / for templates"
                  aria-label="Image prompt; type at sign to mention a reference"
                  aria-autocomplete="list"
                  className={cn(
                    "w-full resize-none bg-transparent px-3 py-3 text-[12px] leading-[1.65] text-[#edecf2] outline-none placeholder:text-[#70727d]",
                    promptExpanded ? "min-h-[230px]" : "min-h-[130px]",
                  )}
                />
                {mention && mentionOptions.length > 0 && (
                  <div
                    role="listbox"
                    aria-label="Image references"
                    className="absolute bottom-2 left-2 right-2 z-40 max-h-48 overflow-y-auto rounded-xl border border-white/[0.12] bg-[#2b2c32] p-1.5 shadow-2xl"
                  >
                    {mentionOptions.map((reference, index) => (
                      <button
                        key={reference.id}
                        type="button"
                        role="option"
                        aria-selected={index === mentionIndex}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectMention(reference)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-colors",
                          index === mentionIndex
                            ? "bg-[#aaa7ff]/15"
                            : "hover:bg-white/[0.05]",
                        )}
                      >
                        <img
                          src={reference.previewUrl}
                          alt=""
                          className="h-8 w-8 shrink-0 rounded-md bg-[#101114] object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[10px] font-medium text-[#e7e6ee]">
                            {reference.tag}
                          </span>
                          <span className="block truncate text-[9px] text-[#858893]">
                            {reference.name}
                          </span>
                        </span>
                        <span className="text-[9px] text-[#aaa7ff]">
                          Insert
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {promptGuideOpen && (
                <div className="border-t border-white/[0.07] px-3 py-2.5 text-[10px] leading-4 text-[#9c9eaa]">
                  <p className="mb-1 font-medium text-[#d4d2ff]">
                    A useful prompt describes
                  </p>
                  <p>
                    Subject and composition · camera and perspective · materials
                    and textures · lighting and atmosphere. Selected style
                    filters are text presets, separate from content references.
                  </p>
                </div>
              )}
              <div className="flex min-h-9 items-center justify-between gap-2 border-t border-white/[0.07] px-2.5 py-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPromptGuideOpen((open) => !open)}
                    aria-pressed={promptGuideOpen}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[9px] transition-colors",
                      promptGuideOpen
                        ? "bg-[#aaa7ff]/10 text-[#c8c5ff]"
                        : "text-[#888b96] hover:bg-white/[0.06] hover:text-white",
                    )}
                  >
                    <span
                      className={cn(
                        "relative h-3.5 w-7 rounded-full transition-colors",
                        promptGuideOpen ? "bg-[#817de0]" : "bg-[#41424a]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-[2px] h-2.5 w-2.5 rounded-full bg-white transition-all",
                          promptGuideOpen ? "left-[14px]" : "left-[2px]",
                        )}
                      />
                    </span>
                    Prompt guide
                  </button>
                  {references.length > 0 && (
                    <span className="hidden text-[9px] text-[#737680] sm:inline">
                      @
                    </span>
                  )}
                  {references.slice(0, 4).map((reference) => (
                    <button
                      key={reference.id}
                      type="button"
                      onClick={() => addTagAtCursor(reference.tag)}
                      title={`Insert ${reference.tag}`}
                      className="rounded-md border border-white/[0.08] bg-white/[0.045] px-1.5 py-1 text-[9px] text-[#c9c7ff] transition-colors hover:border-[#8c88ff]/60 hover:bg-[#aaa7ff]/10"
                    >
                      {reference.tag}
                    </button>
                  ))}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Add content images"
                    aria-label="Upload content images"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[#989aa5] hover:bg-white/[0.07] hover:text-white"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptExpanded((value) => !value)}
                    title={promptExpanded ? "Collapse prompt" : "Expand prompt"}
                    aria-label="Expand prompt editor"
                    className="flex h-6 w-6 items-center justify-center rounded-md text-[#989aa5] hover:bg-white/[0.07] hover:text-white"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[9px] tabular-nums text-[#70737d]">
                    {prompt.length}/{MAX_PROMPT_LENGTH}
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/[0.08] bg-[#222328] px-4 pb-3 pt-3">
          <div className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#858893]">
            <SlidersHorizontal className="h-3 w-3" /> Output settings
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <div
              className="flex h-8 items-center justify-between gap-0.5 rounded-lg bg-[#17181c] px-1"
              aria-label="Number of images"
            >
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease number of images"
                className="flex h-5 w-5 items-center justify-center rounded text-[#b5b6bf] hover:bg-white/[0.08] disabled:opacity-30"
              >
                −
              </button>
              <span className="min-w-3 text-center text-[10px] tabular-nums">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setQuantity((value) => Math.min(MAX_QUANTITY, value + 1))
                }
                disabled={quantity >= MAX_QUANTITY}
                aria-label="Increase number of images"
                className="flex h-5 w-5 items-center justify-center rounded text-[#b5b6bf] hover:bg-white/[0.08] disabled:opacity-30"
              >
                +
              </button>
            </div>
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setAspectPickerOpen((open) => !open)}
                aria-expanded={aspectPickerOpen}
                className="flex h-8 w-full items-center justify-center gap-1 rounded-lg bg-[#17181c] px-1.5 text-[10px] hover:bg-[#2b2c31]"
              >
                {aspectRatio === "auto" ? "AUTO" : aspectRatio}
                <ChevronDown className="h-3 w-3 text-[#898b96]" />
              </button>
              {aspectPickerOpen && (
                <div className="absolute bottom-10 left-0 z-50 w-40 rounded-xl border border-white/[0.12] bg-[#2b2c32] p-1.5 shadow-2xl">
                  {IMAGE2_ASPECT_RATIOS.map((ratio) => (
                    <button
                      key={ratio}
                      type="button"
                      disabled={!frameSupported(ratio)}
                      title={
                        frameSupported(ratio)
                          ? undefined
                          : "Not available natively with the selected model"
                      }
                      onClick={() => {
                        setAspectRatio(ratio);
                        setAspectPickerOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[10px] transition-colors",
                        ratio === aspectRatio
                          ? "bg-[#aaa7ff]/15 text-[#d1cfff]"
                          : "text-[#d4d4db] hover:bg-white/[0.06]",
                        !frameSupported(ratio) &&
                          "cursor-not-allowed opacity-35 hover:bg-transparent",
                      )}
                    >
                      <span>
                        {ratio === "auto" ? "AUTO" : ratio}{" "}
                        <span className="ml-1 text-[#858893]">
                          {RATIO_DESCRIPTIONS[ratio]}
                        </span>
                      </span>
                      {ratio === aspectRatio && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label className="flex h-8 min-w-0 items-center justify-center rounded-lg bg-[#17181c] px-1.5 text-[9px] text-[#9597a2]">
              {" "}
              <select
                value={resolution}
                onChange={(event) =>
                  setResolution(event.target.value as Resolution)
                }
                aria-label="Output resolution"
                className="w-full min-w-0 bg-transparent text-center text-[10px] text-[#e5e5eb] outline-none"
              >
                {RESOLUTIONS.map((value) => (
                  <option
                    key={value}
                    value={value}
                    disabled={!availableResolutions.includes(value)}
                    title={
                      availableResolutions.includes(value)
                        ? undefined
                        : "This model does not expose this resolution"
                    }
                    className="bg-[#222328]"
                  >
                    {value}
                    {availableResolutions.includes(value) ? "" : " · unsupported"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-8 min-w-0 items-center justify-center rounded-lg bg-[#17181c] px-1.5">
              <select
                value={quality}
                onChange={(event) =>
                  setQuality(event.target.value as QualityTier)
                }
                aria-label="Output quality"
                className="w-full min-w-0 bg-transparent text-center text-[9px] text-[#e5e5eb] outline-none"
              >
                {QUALITY_TIERS.map((tier) => (
                  <option
                    key={tier.id}
                    value={tier.id}
                    disabled={
                      !availableQualityTiers.some(
                        (supported) => supported.id === tier.id,
                      )
                    }
                    title={
                      availableQualityTiers.some(
                        (supported) => supported.id === tier.id,
                      )
                        ? undefined
                        : "This model does not expose this quality tier"
                    }
                    className="bg-[#222328]"
                  >
                    {tier.label}
                    {availableQualityTiers.some(
                      (supported) => supported.id === tier.id,
                    )
                      ? ""
                      : " · unsupported"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[9px] text-[#727580]">Project</span>
            <select
              value={selectedProjectId ?? ""}
              onChange={(event) =>
                setSelectedProjectId(event.target.value || null)
              }
              aria-label="Active project"
              className="min-w-0 flex-1 truncate bg-transparent text-[10px] text-[#d7d8df] outline-none"
            >
              <option value="" className="bg-[#222328]">
                Default project
              </option>
              {projects.map((project) => (
                <option
                  key={project.id}
                  value={project.id}
                  className="bg-[#222328]"
                >
                  {project.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setProjectCreateOpen((open) => !open);
                setProjectDraft("");
              }}
              title="Create project"
              aria-label="Create project"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#9b9da6] hover:bg-white/[0.06] hover:text-white"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          {projectCreateOpen && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateProjectInline();
              }}
              className="mt-2 flex gap-1.5"
            >
              <input
                value={projectDraft}
                onChange={(event) => setProjectDraft(event.target.value)}
                autoFocus
                maxLength={80}
                placeholder="New project name"
                className="h-7 min-w-0 flex-1 rounded-md border border-white/[0.12] bg-[#17181c] px-2 text-[10px] outline-none focus:border-[#8c88ff]"
              />
              <button
                type="submit"
                disabled={!projectDraft.trim() || projectCreateBusy}
                className="h-7 rounded-md bg-[#aaa7ff] px-2.5 text-[10px] font-semibold text-[#17171b] disabled:opacity-50"
              >
                {projectCreateBusy ? "…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setProjectCreateOpen(false)}
                aria-label="Cancel new project"
                className="flex h-7 w-7 items-center justify-center rounded-md text-[#9b9da6] hover:bg-white/[0.06]"
              >
                <X className="h-3 w-3" />
              </button>
            </form>
          )}
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[9px] text-[#858893]">
              {costsConfig ? `${activeCost} credits` : "Cost loading…"}
              {balance !== null ? ` · ${balance} available` : ""}
            </span>
            <button
              type="button"
              onClick={() => void handleGenerate()}
              disabled={!canGenerate || isBusy || !hasEnoughCredits}
              className="inline-flex h-10 min-w-[138px] flex-1 items-center justify-between gap-3 rounded-lg bg-[#f2f0ff] px-3.5 text-xs font-semibold text-[#17171b] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-[#3a3b42] disabled:text-[#858892]"
            >
              <span className="flex items-center gap-2">
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {isBusy ? "Generating…" : "Generate"}
              </span>
              <span className="text-[10px] opacity-70">
                {costsConfig ? `${activeCost} cr` : "—"}
              </span>
            </button>
          </div>
          {costsConfig && balance !== null && balance < activeCost && (
            <p className="mt-1.5 text-right text-[9px] text-rose-300">
              Not enough credits for this generation.
            </p>
          )}
        </footer>
      </aside>

      <section
        aria-label="Creations workspace"
        className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-[#222328]"
      >
        <div className="sticky top-0 z-40 flex min-h-[52px] flex-wrap items-center gap-2 border-b border-white/[0.07] bg-[#222328] px-3 py-2.5 md:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]">
            {(["Creations", "My templates", "Academy"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFeedTab(tab)}
                aria-pressed={feedTab === tab}
                className={cn(
                  "inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-full px-3 text-xs transition-colors",
                  feedTab === tab
                    ? "bg-[#17181c] font-medium text-white"
                    : "text-[#8b8e98] hover:bg-white/[0.04] hover:text-white",
                )}
              >
                {tab === "Creations" ? (
                  <Images className="h-3.5 w-3.5" />
                ) : tab === "My templates" ? (
                  <BookOpen className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {tab}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setFeedFilter((current) =>
                  current === "favorites" ? "all" : "favorites",
                )
              }
              aria-pressed={feedFilter === "favorites"}
              aria-label="Show favorites"
              title="Favorites"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                feedFilter === "favorites"
                  ? "bg-[#f1c8d8]/15 text-[#f2b9d0]"
                  : "bg-[#17181c] text-[#a5a7b0] hover:bg-[#2b2c31] hover:text-white",
              )}
            >
              <Heart className="h-3.5 w-3.5" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setLayoutOpen((open) => !open);
                  setFiltersOpen(false);
                }}
                aria-expanded={layoutOpen}
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#17181c] px-3 text-xs text-[#d5d5dd] transition-colors hover:bg-[#2b2c31]"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Layout</span>
                <ChevronDown className="h-3 w-3 text-[#888b96]" />
              </button>
              {layoutOpen && (
                <div className="absolute right-0 top-10 z-50 w-40 rounded-xl border border-white/[0.10] bg-[#2b2c32] p-1.5 shadow-2xl">
                  <p className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#858893]">
                    Gallery density
                  </p>
                  {([2, 3, 4] as const).map((columns) => (
                    <button
                      key={columns}
                      type="button"
                      onClick={() => {
                        setFeedColumns(columns);
                        setLayoutOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-2 text-[10px]",
                        feedColumns === columns
                          ? "bg-[#aaa7ff]/15 text-[#d4d1ff]"
                          : "text-[#d1d2da] hover:bg-white/[0.06]",
                      )}
                    >
                      {columns === 2
                        ? "Large previews"
                        : columns === 3
                          ? "Comfortable"
                          : "Compact"}
                      {feedColumns === columns && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setFiltersOpen((open) => !open);
                  setLayoutOpen(false);
                }}
                aria-expanded={filtersOpen}
                aria-pressed={feedFilter !== "all"}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-xs transition-colors",
                  filtersOpen || feedFilter !== "all"
                    ? "bg-[#363641] text-white"
                    : "bg-[#17181c] text-[#d5d5dd] hover:bg-[#2b2c31]",
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </button>
              {filtersOpen && (
                <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-white/[0.10] bg-[#2b2c32] p-1.5 shadow-2xl">
                  <p className="px-2 py-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#858893]">
                    Show
                  </p>
                  {(
                    [
                      { id: "all", label: "All images" },
                      { id: "generated", label: "Generated" },
                      { id: "project", label: "Project images" },
                      { id: "favorites", label: "Favorites" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFeedFilter(item.id);
                        setFiltersOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-[10px]",
                        feedFilter === item.id
                          ? "bg-[#aaa7ff]/15 text-[#d4d1ff]"
                          : "text-[#d1d2da] hover:bg-white/[0.06]",
                      )}
                    >
                      {item.label}
                      {feedFilter === item.id && <Check className="h-3 w-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFeedSearchOpen((open) => !open)}
              aria-expanded={feedSearchOpen}
              aria-label="Search creations"
              title="Search"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#17181c] text-[#a5a7b0] transition-colors hover:bg-[#2b2c31] hover:text-white"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
          {feedSearchOpen && (
            <div className="w-full">
              <input
                value={feedSearch}
                onChange={(event) => setFeedSearch(event.target.value)}
                autoFocus
                placeholder="Search creations…"
                className="h-8 w-full rounded-lg border border-white/[0.10] bg-[#17181c] px-3 text-xs outline-none placeholder:text-[#6e717c] focus:border-[#8c88ff]"
              />
            </div>
          )}
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 pt-2 md:px-4"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "#393a42 transparent",
          }}
        >
          {error && (
            <div
              role="alert"
              className="mb-3 flex items-start gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-3 py-2.5 text-[11px] leading-5 text-rose-200"
            >
              <span className="min-w-0 flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                aria-label="Dismiss message"
                className="shrink-0 text-rose-100/70 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {feedTab === "Creations" ? (
            <>
              {isBusy && (
                <div className="mb-3 overflow-hidden rounded-xl border border-white/[0.07] bg-[#292a30] p-3">
                  <div className="mb-3 flex items-center gap-2 text-[11px] text-[#c6c4ff]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating your image…
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="aspect-[4/3] animate-pulse rounded-lg bg-gradient-to-br from-[#34353d] via-[#2b2c33] to-[#26272d]" />
                    <div className="hidden aspect-[4/3] animate-pulse rounded-lg bg-gradient-to-br from-[#34353d] via-[#2b2c33] to-[#26272d] sm:block" />
                  </div>
                </div>
              )}
              {selectedOutputUrls.length > 0 && (
                <div
                  className="mb-3 rounded-xl bg-[#292a30] p-3"
                  data-cy="generated-image-group"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] text-[#a7a9b3]">
                    <span
                      className="max-w-full flex-1 truncate text-[#c5c6ce]"
                      title={lastGenerationMeta?.prompt ?? prompt}
                    >
                      {(lastGenerationMeta?.prompt ?? prompt) || "Image creation"}
                    </span>
                    <span className="rounded bg-[#1d1e23] px-1.5 py-1">
                      {(lastGenerationMeta?.aspectRatio ?? aspectRatio) === "auto" ? "AUTO" : (lastGenerationMeta?.aspectRatio ?? aspectRatio)}
                    </span>
                    <span className="rounded bg-[#1d1e23] px-1.5 py-1">
                      {lastGenerationMeta?.quality ?? quality}
                    </span>
                    <span className="rounded bg-[#1d1e23] px-1.5 py-1">
                      {lastGenerationMeta?.resolution ?? resolution}
                    </span>
                    <span className="rounded bg-[#1d1e23] px-1.5 py-1">
                      {lastGenerationMeta?.modelLabel ?? selectedModelOption?.name ?? "Auto"}
                    </span>
                    <span className="ml-auto">Just created</span>
                  </div>
                  <div
                    className={cn(
                      "grid items-start gap-3",
                      feedColumns === 2
                        ? "grid-cols-1 sm:grid-cols-2"
                        : feedColumns === 3
                          ? "grid-cols-2 lg:grid-cols-3"
                          : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
                    )}
                  >
                    {selectedOutputUrls.map((url, index) => (
                      <article
                        key={`${url}-${index}`}
                        className="group/output relative min-w-0 overflow-hidden rounded-xl bg-[#17181c]"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOutputIndex(index);
                            setZoomedImage(url);
                          }}
                          aria-label={`Open generated image ${index + 1}`}
                          className="relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a09cff]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`Generated image ${index + 1}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover/output:scale-[1.025]"
                            loading={index === 0 ? "eager" : "lazy"}
                          />
                          <span className="absolute bottom-2 left-2 rounded-full bg-black/45 px-2 py-1 text-[9px] text-white backdrop-blur">
                            <Sparkles className="mr-1 inline h-2.5 w-2.5" />
                            {lastGenerationMeta?.resolution ?? resolution}
                          </span>
                        </button>
                        <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/output:opacity-100">
                          <button
                            type="button"
                            onClick={() => void saveResult(url, "image")}
                            aria-label="Download image"
                            title="Download"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomedImage(url)}
                            aria-label="Zoom image"
                            title="Zoom"
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                          >
                            <ZoomIn className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex h-8 items-center justify-between gap-2 bg-[#17181c] px-2.5">
                          <span className="truncate text-[9px] text-[#a6a8b1]">
                            Image {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedOutputIndex(index)}
                            aria-pressed={selectedOutputIndex === index}
                            className={cn(
                              "rounded-full px-2 py-1 text-[9px]",
                              selectedOutputIndex === index
                                ? "bg-[#aaa7ff]/15 text-[#c9c6ff]"
                                : "text-[#858893] hover:bg-white/[0.06]",
                            )}
                          >
                            {selectedOutputIndex === index
                              ? "Selected"
                              : "Select"}
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {filteredCreationItems.length > 0 ? (
                <div
                  className={cn(
                    "grid items-start gap-3",
                    feedColumns === 2
                      ? "grid-cols-1 sm:grid-cols-2"
                      : feedColumns === 3
                        ? "grid-cols-2 lg:grid-cols-3"
                        : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4",
                  )}
                >
                  {creationFeedEntries.map((entry) => {
                    if (entry.kind === "group") {
                      const groupItem = entry.item;
                      const actualModel = modelOptions.find(
                        (model) => model.key === groupItem.generationModelUsed,
                      )?.name;
                      const selectedModelName = modelOptions.find(
                        (model) =>
                          model.key === groupItem.generationSelectedModel,
                      )?.name;
                      const dateValue =
                        groupItem.generationCreatedAt ?? groupItem.createdAt;
                      return (
                        <div
                          key={entry.key}
                          className="col-span-full flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-white/[0.08] pb-2 pt-1"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold text-[#d8d8e2]">
                              Generation
                              {dateValue
                                ? ` · ${new Date(dateValue).toLocaleString()}`
                                : ""}
                            </p>
                            <p
                              className="mt-1 line-clamp-2 break-words text-[10px] leading-4 text-[#8f929d]"
                              title={
                                groupItem.generationPrompt ?? "Image creation"
                              }
                            >
                              {groupItem.generationPrompt || "Image creation"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">
                              {groupItem.generationAspectRatio === "auto"
                                ? "AUTO"
                                : groupItem.generationAspectRatio ?? "Frame n/a"}
                            </span>
                            {groupItem.generationQuality && (
                              <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">
                                {groupItem.generationQuality}
                              </span>
                            )}
                            {groupItem.generationResolution && (
                              <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">
                                {groupItem.generationResolution}
                              </span>
                            )}
                            <span className="rounded bg-[#17181c] px-1.5 py-1 text-[9px] text-[#bfc0ca]">
                              {selectedModelName ??
                                (groupItem.generationSelectedModel
                                  ? groupItem.generationSelectedModel
                                  : actualModel
                                    ? `Auto · ${actualModel}`
                                    : "Auto")}
                            </span>
                          </div>
                        </div>
                      );
                    }
                    const item = entry.item;
                    return (
                      <article
                        key={item.id}
                        className="group/feed-item relative min-w-0 overflow-hidden rounded-xl bg-[#292a30]"
                      >
                        <div className="relative overflow-hidden rounded-t-xl bg-[#17181c]">
                          <button
                            type="button"
                            onClick={() => setZoomedImage(item.url)}
                            aria-label={`Preview ${item.name}`}
                            className="block aspect-[4/3] w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#a09cff]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.url}
                              alt={item.name}
                              loading="lazy"
                              className="h-full w-full object-cover transition-transform duration-300 group-hover/feed-item:scale-[1.025]"
                            />
                          </button>
                          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition-opacity group-hover/feed-item:opacity-100">
                            <button
                              type="button"
                              onClick={() => setZoomedImage(item.url)}
                              aria-label="Zoom"
                              title="Zoom"
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/70"
                            >
                              <ZoomIn className="h-3 w-3" />
                            </button>
                            {item.kind === "generated" && (
                              <button
                                type="button"
                                onClick={() => void saveResult(item.url, "image")}
                                aria-label="Download"
                                title="Download"
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/70"
                              >
                                <Download className="h-3 w-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setZoomedImage(item.url)}
                              aria-label="Open preview"
                              title="Open preview"
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/70"
                            >
                              <ZoomIn className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex min-h-9 items-center gap-1.5 rounded-b-xl bg-[#292a30] px-2">
                          <button
                            type="button"
                            onClick={() =>
                              item.assetId
                                ? addProjectAssetToReferences(
                                    assets.find(
                                      (asset) => asset.id === item.assetId,
                                    ) ?? {
                                      id: item.assetId!,
                                      type: "image",
                                      url: item.url,
                                    },
                                  )
                                : setZoomedImage(item.url)
                            }
                            title={
                              item.assetId
                                ? "Add to content references"
                                : "Open generated image"
                            }
                            className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 text-left text-[9px] text-[#c5c6ce] hover:bg-white/[0.06]"
                          >
                            <ImagePlus className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {item.assetId ? "Use as input" : item.name}
                            </span>
                          </button>
                          <span className="shrink-0 text-[8px] text-[#757883]">
                            {item.kind === "generated" ? "Generated" : "Project"}
                          </span>
                        </div>
                        <div className="flex h-7 items-center justify-between gap-2 border-t border-white/[0.05] px-2.5">
                          <button
                            type="button"
                            onClick={() =>
                              setFeedFilter((current) =>
                                current === "favorites" ? "all" : "favorites",
                              )
                            }
                            aria-label="Filter favorites"
                            className="flex h-5 w-5 items-center justify-center rounded-full text-[#737680] hover:bg-white/[0.06] hover:text-[#efb5ce]"
                          >
                            <Heart className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomedImage(item.url)}
                            className="flex items-center gap-1 rounded px-1.5 py-1 text-[9px] text-[#858893] hover:bg-white/[0.06] hover:text-white"
                          >
                            <MessageCircle className="h-3 w-3" />
                            Preview
                          </button>
                          <button
                            type="button"
                            onClick={() => setZoomedImage(item.url)}
                            className="rounded px-1.5 py-1 text-[9px] text-[#858893] hover:bg-white/[0.06] hover:text-white"
                          >
                            Preview
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                !isBusy && (
                  <div className="flex min-h-[min(54vh,520px)] flex-col items-center justify-center px-5 py-12 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#292a30] text-[#888b96]">
                      {feedFilter === "favorites" ? (
                        <Heart className="h-5 w-5" />
                      ) : feedSearch ? (
                        <Search className="h-5 w-5" />
                      ) : (
                        <Images className="h-5 w-5" />
                      )}
                    </span>
                    <h2 className="mt-4 text-sm font-medium text-[#dedee5]">
                      {feedFilter === "favorites"
                        ? "No favorites yet"
                        : feedSearch
                          ? "No matching images"
                          : "Your creations will appear here"}
                    </h2>
                    <p className="mt-2 max-w-sm text-xs leading-5 text-[#81848e]">
                      {feedFilter === "favorites"
                        ? "Favorite support depends on which assets are marked as favorites in your project."
                        : feedSearch
                          ? "Try another search term or clear the filters."
                          : "Add a separate style reference if needed, describe the image and generate. Your results will appear here."}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setFeedFilter("all");
                        setFeedSearch("");
                        setFeedSearchOpen(false);
                      }}
                      className="mt-4 rounded-lg bg-[#303139] px-3 py-2 text-[10px] text-[#d6d6df] hover:bg-[#393a44]"
                    >
                      Clear filters
                    </button>
                  </div>
                )
              )}
            </>
          ) : feedTab === "My templates" ? (
            <div className="flex min-h-[min(54vh,520px)] flex-col items-center justify-center px-5 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#292a30] text-[#888b96]">
                <BookOpen className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-sm font-medium text-[#dedee5]">
                Your templates
              </h2>
              <p className="mt-2 max-w-sm text-xs leading-5 text-[#81848e]">
                Saved template integration is not connected in this experimental
                workspace. Use Templates above the form to start from a prompt
                preset.
              </p>
              <button
                type="button"
                onClick={() => {
                  setFeedTab("Creations");
                  setTemplatesOpen(true);
                }}
                className="mt-4 rounded-lg bg-[#f2f0ff] px-3 py-2 text-[10px] font-semibold text-[#17171b] hover:bg-white"
              >
                Browse prompt starters
              </button>
            </div>
          ) : (
            <div className="flex min-h-[min(54vh,520px)] flex-col items-center justify-center px-5 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-[#292a30] text-[#888b96]">
                <Sparkles className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-sm font-medium text-[#dedee5]">
                Image generation workspace
              </h2>
              <p className="mt-2 max-w-sm text-xs leading-5 text-[#81848e]">
                Explore a prompt guide, visual style filters and content
                references, and the model selector. Academy content is not
                connected to this experimental page.
              </p>
            </div>
          )}
        </div>
      </section>

      {stylePickerOpen && (
        <div
          className="fixed inset-0 z-[205] flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setStylePickerOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="image2-style-picker-title"
            className="flex max-h-[min(800px,92vh)] w-full max-w-[900px] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#23242a] text-[#eeeef2] shadow-2xl"
          >
            <div className="border-b border-white/[0.08] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2
                    id="image2-style-picker-title"
                    className="text-lg font-medium"
                  >
                    Styles
                  </h2>
                  <p className="mt-1 text-[11px] text-[#858893]">
                    Choose up to 3 filters. These references are visual examples
                    only and are never sent to the generation model.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStylePickerOpen(false)}
                  aria-label="Close style picker"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9b9da7] hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="flex min-w-0 flex-wrap gap-1.5"
                  role="group"
                  aria-label="Filter style categories"
                >
                  {IMAGE2_STYLE_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setStyleFilterCategory(category)}
                      aria-pressed={styleFilterCategory === category}
                      className={cn(
                        "h-7 rounded-lg px-3 text-[10px] font-medium transition-colors",
                        styleFilterCategory === category
                          ? "bg-[#3a3b43] text-white"
                          : "text-[#92949f] hover:bg-white/[0.05] hover:text-white",
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:max-w-[250px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#777a85]" />
                  <input
                    value={styleFilterSearch}
                    onChange={(event) =>
                      setStyleFilterSearch(event.target.value)
                    }
                    placeholder="Search styles…"
                    aria-label="Search style filters"
                    className="h-8 w-full rounded-lg border border-white/[0.09] bg-[#191a1f] pl-9 pr-3 text-xs outline-none placeholder:text-[#70727d] focus:border-[#8c88ff]"
                  />
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {IMAGE2_STYLE_FILTERS.filter(
                  (item) =>
                    (styleFilterCategory === "All" ||
                      item.category === styleFilterCategory) &&
                    `${item.tag} ${item.label} ${item.description}`
                      .toLowerCase()
                      .includes(styleFilterSearch.trim().toLowerCase()),
                ).map((item) => {
                  const active = selectedStyleFilters.includes(item.id);
                  const canAdd = active || selectedStyleFilters.length < 3;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleStyleFilter(item.id)}
                      aria-pressed={active}
                      title={item.description}
                      className={cn(
                        "group relative min-w-0 overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a09cff]",
                        active
                          ? "border-[#aaa7ff] bg-[#aaa7ff]/10"
                          : "border-white/[0.08] bg-[#1a1b20] hover:border-white/[0.20]",
                        !canAdd && "opacity-55",
                      )}
                    >
                      <div className="relative aspect-square overflow-hidden bg-[#15161a]">
                        <img
                          src={item.previewUrl}
                          alt={`${item.tag} style preview`}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.025]"
                        />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/65 to-transparent" />
                        <span className="absolute left-2 top-2 rounded-md border border-white/15 bg-black/55 px-1.5 py-1 text-[9px] font-semibold text-white backdrop-blur">
                          {item.tag}
                        </span>
                        <span
                          className={cn(
                            "absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border",
                            active
                              ? "border-[#d0ceff] bg-[#aaa7ff] text-[#17171b]"
                              : "border-white/55 bg-black/25 text-transparent",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </div>
                      <span className="block px-2.5 pb-2.5 pt-2">
                        <span className="block truncate text-[11px] font-medium text-[#e8e8ef]">
                          {item.label}
                        </span>
                        <span className="mt-1 block line-clamp-2 min-h-8 text-[9px] leading-4 text-[#858893]">
                          {item.description}
                        </span>
                        <span className="mt-1 block text-[8px] text-[#686b75]">
                          Preview source: linked image source page
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {IMAGE2_STYLE_FILTERS.filter(
                (item) =>
                  (styleFilterCategory === "All" ||
                    item.category === styleFilterCategory) &&
                  `${item.tag} ${item.label} ${item.description}`
                    .toLowerCase()
                    .includes(styleFilterSearch.trim().toLowerCase()),
              ).length === 0 && (
                <div className="py-12 text-center text-xs text-[#858893]">
                  No matching styles.
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#1b1c20] px-4 py-3">
              <p className="text-[10px] text-[#92949f]">
                {selectedStyleFilters.length}/3 selected
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStyleFilters([]);
                    setStyleFilterNotice(null);
                  }}
                  className="h-8 rounded-lg px-3 text-[10px] text-[#9c9eaa] hover:bg-white/[0.06] hover:text-white"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={() => setStylePickerOpen(false)}
                  className="h-8 rounded-lg bg-[#f2f0ff] px-4 text-[10px] font-semibold text-[#17171b] hover:bg-white"
                >
                  Done
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {modelPickerOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModelPickerOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={modelDialogTitleId}
            className="flex max-h-[min(760px,92vh)] w-full max-w-[780px] flex-col overflow-hidden rounded-2xl border border-white/[0.12] bg-[#23242a] text-[#eeeef2] shadow-2xl"
          >
            <div className="border-b border-white/[0.08] p-3 sm:p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777a85]" />
                <input
                  ref={modelSearchRef}
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder="Search AI models or providers…"
                  className="h-10 w-full rounded-lg border border-white/[0.10] bg-[#17181c] pl-10 pr-3 text-sm outline-none placeholder:text-[#6f727c] focus:border-[#8c88ff]"
                />
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <label className="flex h-8 items-center gap-2 rounded-md border border-white/[0.09] bg-[#2d2e35] px-2.5 text-[10px] text-[#9d9fa8]">
                  Provider
                  <select
                    value={providerFilter}
                    onChange={(event) => setProviderFilter(event.target.value)}
                    className="max-w-[170px] bg-transparent text-[10px] text-[#e2e2e8] outline-none"
                  >
                    <option value="all" className="bg-[#2d2e35]">
                      All providers
                    </option>
                    {providers.map((provider) => (
                      <option
                        key={provider}
                        value={provider}
                        className="bg-[#2d2e35]"
                      >
                        {provider}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex h-8 items-center gap-2 rounded-md border border-white/[0.09] bg-[#2d2e35] px-2.5 text-[10px] text-[#9d9fa8]">
                  Status
                  <select
                    value={modelStatusFilter}
                    onChange={(event) =>
                      setModelStatusFilter(
                        event.target.value as
                          | "all"
                          | "configured"
                          | "unconfigured",
                      )
                    }
                    className="bg-transparent text-[10px] text-[#e2e2e8] outline-none"
                  >
                    <option value="all" className="bg-[#2d2e35]">
                      All models
                    </option>
                    <option value="configured" className="bg-[#2d2e35]">
                      Ready to use
                    </option>
                    <option value="unconfigured" className="bg-[#2d2e35]">
                      Not configured
                    </option>
                  </select>
                </label>
                <span className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md bg-[#aaa7ff]/10 px-2.5 text-[9px] text-[#c9c6ff]">
                  <Sparkles className="h-3 w-3" /> Image · Text-to-image
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <h2 id={modelDialogTitleId} className="text-sm font-semibold">
                    Choose AI model
                  </h2>
                  <p className="mt-1 text-[10px] text-[#858892]">
                    These are the models returned by this project&apos;s Image
                    Generation service catalogue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModelPickerOpen(false)}
                  aria-label="Close model selector"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#a1a3ac] hover:bg-white/[0.06] hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              <button
                type="button"
                onClick={() => handleModelSelection("")}
                disabled={
                  modelOptions.length > 0 &&
                  compatibleConfiguredModels.length === 0
                }
                aria-pressed={!selectedModel}
                className={cn(
                  "mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  !selectedModel
                    ? "border-[#aaa7ff]/60 bg-[#aaa7ff]/[0.09]"
                    : "border-white/[0.08] bg-[#191a1f] hover:bg-[#292a30]",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[#c2c0ff]">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    Auto (recommended)
                  </span>
                  <span className="mt-1 block text-[10px] text-[#898c96]">
                    {resolvedAutoModel
                      ? `Will use ${resolvedAutoModel.name} (${providerLabel(resolvedAutoModel.provider, resolvedAutoModel)}) — cheapest configured model matching your inputs.`
                      : "Automatically pick a configured model that supports your content references and requested quality."}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    !selectedModel
                      ? "border-[#aaa7ff] bg-[#aaa7ff] text-[#17171b]"
                      : "border-white/20 text-transparent",
                  )}
                >
                  <Check className="h-3 w-3" />
                </span>
              </button>
              {filteredModels.length === 0 ? (
                <div className="flex min-h-[150px] flex-col items-center justify-center rounded-lg border border-dashed border-white/[0.10] px-5 text-center">
                  <Search className="h-5 w-5 text-[#777a84]" />
                  <p className="mt-3 text-xs font-medium">No matching models</p>
                  <p className="mt-1 text-[10px] text-[#858892]">
                    Try another search or change the provider/status filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {filteredModels.map((model) => {
                    const active = model.key === selectedModel;
                    const provider = providerLabel(model.provider, model);
                    const maxRefs = model.maxReferences ?? 0;
                    const fitsReferences = imageInputCount <= maxRefs;
                    return (
                      <button
                        key={model.key}
                        type="button"
                        onClick={() => handleModelSelection(model.key)}
                        aria-pressed={active}
                        className={cn(
                          "group flex min-h-[108px] w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                          active
                            ? "border-[#aaa7ff]/60 bg-[#aaa7ff]/[0.08]"
                            : "border-white/[0.07] bg-[#1e1f24] hover:border-white/[0.13] hover:bg-[#27282f]",
                          !model.configured && "opacity-75",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#2d2e35] text-[10px] font-semibold text-[#cbc9ff]">
                          {provider.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-medium text-[#f1f0f6]">
                              {model.name}
                            </span>
                            {model.configured ? (
                              <span className="rounded bg-emerald-300/10 px-1.5 py-0.5 text-[8px] text-emerald-200">
                                Ready
                              </span>
                            ) : (
                              <span className="rounded bg-amber-300/10 px-1.5 py-0.5 text-[8px] text-amber-200">
                                Not configured
                              </span>
                            )}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1">
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-[#acafb9]">
                              {provider}
                            </span>
                            <span className="rounded bg-[#aaa7ff]/10 px-1.5 py-0.5 text-[8px] text-[#c2bfff]">
                              {model.service ?? "Image · Text-to-image"}
                            </span>
                            <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-[#acafb9]">
                              {maxRefs > 0
                                ? `${maxRefs} content images max`
                                : "Prompt only"}
                            </span>
                          </span>
                          {model.description && (
                            <span className="mt-1.5 block line-clamp-3 text-[10px] leading-4 text-[#858892]">
                              {model.description}
                            </span>
                          )}
                          {model.frameRatios && (
                            <span className="mt-1 block text-[9px] leading-4 text-[#858892]">
                              Supported frames: {model.frameRatios.join(" · ")}
                            </span>
                          )}
                          {!fitsReferences && (
                            <span className="mt-1 block text-[9px] text-rose-200">
                              Needs fewer image inputs ({imageInputCount}{" "}
                              selected).
                            </span>
                          )}
                        </span>
                        <span
                          className={cn(
                            "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                            active
                              ? "border-[#aaa7ff] bg-[#aaa7ff] text-[#17171b]"
                              : "border-white/20 text-transparent",
                          )}
                        >
                          <Check className="h-3 w-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] bg-[#1b1c20] px-4 py-3">
              <p className="text-[10px] text-[#858892]">
                {filteredModels.length} of {modelOptions.length} models ·{" "}
                {imageInputCount}/14 content images
              </p>
              <button
                type="button"
                onClick={() => setModelPickerOpen(false)}
                className="h-8 rounded-lg bg-[#f2f0ff] px-4 text-[10px] font-semibold text-[#17171b] hover:bg-white"
              >
                Done
              </button>
            </div>
          </section>
        </div>
      )}

      {zoomedImage && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setZoomedImage(null);
          }}
        >
          <button
            type="button"
            onClick={() => setZoomedImage(null)}
            aria-label="Close image preview"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-lg border border-white/20 bg-black/50 text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={zoomedImage}
            alt="Image full preview"
            className="max-h-[92vh] max-w-[94vw] rounded-md object-contain"
          />
        </div>
      )}
    </main>
  );
}
