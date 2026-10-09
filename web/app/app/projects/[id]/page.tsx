"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  AssetCard,
  type AssetSummary,
} from "@/components/projects/asset-card";
import { AssetSelectionToolbar } from "@/components/projects/asset-selection-toolbar";
import {
  AssetLayoutControls,
  assetLayoutClass,
} from "@/components/projects/asset-layout-controls";
import {
  AssetServiceFilter,
} from "@/components/projects/asset-service-filter";
import { useAssetLayout } from "@/components/projects/use-asset-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type TypeFilter = "all" | "image" | "video" | "audio";

function normalizeType(value: string | null): TypeFilter {
  if (
    value === "image" ||
    value === "video" ||
    value === "audio"
  ) {
    return value;
  }

  return "all";
}

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filter = normalizeType(searchParams.get("type"));
  const serviceFilter = searchParams.get("feature") ?? "all";

  const [projectName, setProjectName] = useState<string | null>(null);
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { layout, columns, setLayout, setColumns } =
    useAssetLayout(`project:${params.id}`);

  const fetchProject = useCallback(
    async (type: TypeFilter, service: string) => {
      try {
        setError(null);

        const query = new URLSearchParams();

        if (type !== "all") {
          query.set("type", type);
        }

        if (service !== "all") {
          query.set("feature", service);
        }

        const suffix = query.toString()
          ? `?${query.toString()}`
          : "";

        const response = await fetch(
          `/api/projects/${params.id}${suffix}`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as {
          project: {
            id: string;
            name: string;
          };
          assets: AssetSummary[];
        };

        setProjectName(data.project.name);
        setAssets(data.assets);
        setSelectedAssetId((current) =>
          current && data.assets.some((asset) => asset.id === current)
            ? current
            : null,
        );
      } catch {
        setError("Could not load this project.");
        setAssets(null);
      }
    },
    [params.id],
  );

  useEffect(() => {
    void fetchProject(filter, serviceFilter);
  }, [fetchProject, filter, serviceFilter]);

  const updateFilter = (nextType: TypeFilter) => {
    const params = new URLSearchParams(
      searchParams.toString(),
    );

    if (nextType === "all") {
      params.set("type", "all");
    } else {
      params.set("type", nextType);
    }

    params.delete("feature");

    const query = params.toString();

    router.replace(
      query ? `${pathname}?${query}` : pathname,
      { scroll: false },
    );
  };

  const updateServiceFilter = (nextService: string) => {
    const params = new URLSearchParams(
      searchParams.toString(),
    );

    if (nextService === "all") {
      params.delete("feature");
    } else {
      params.set("feature", nextService);
    }

    const query = params.toString();

    router.replace(
      query ? `${pathname}?${query}` : pathname,
      { scroll: false },
    );
  };

  const deleteProject = async () => {
    if (!projectName) {
      return;
    }

    const confirmed = window.confirm(
      `Delete project "${projectName}" and all its assets? This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(
        `/api/projects/${params.id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      window.dispatchEvent(new Event("projects:updated"));
      router.push("/app/projects");
    } catch {
      setError("Could not delete the project.");
      setDeleting(false);
    }
  };

  const activeFilterLabel = useMemo(() => {
    switch (filter) {
      case "image":
        return "Images";
      case "video":
        return "Videos";
      case "audio":
        return "Audio";
      default:
        return "All assets";
    }
  }, [filter]);

  const selectedAsset =
    assets?.find((asset) => asset.id === selectedAssetId) ?? null;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-semibold">
              {projectName
                ?.trim()
                .charAt(0)
                .toUpperCase() || "P"}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  href="/app/projects"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Projects
                </Link>

                <span aria-hidden="true" className="text-xs text-muted-foreground/40">
                  /
                </span>

                <span className="truncate text-sm text-muted-foreground">
                  {projectName ?? "Project"}
                </span>
              </div>

              <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                {projectName ?? "Loading project..."}
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                {assets === null
                  ? "Loading assets..."
                  : `${assets.length} ${activeFilterLabel.toLowerCase()}`}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <Tabs
            value={filter}
            onValueChange={(value) =>
              updateFilter(value as TypeFilter)
            }
          >
            <TabsList>
              <TabsTrigger value="all">
                All
              </TabsTrigger>

              <TabsTrigger value="image">
                Images
              </TabsTrigger>

              <TabsTrigger value="video">
                Videos
              </TabsTrigger>

              <TabsTrigger value="audio">
                Audio
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={() => void deleteProject()}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </header>

      {(filter === "image" || filter === "video") && (
        <AssetServiceFilter
          type={filter}
          value={serviceFilter}
          onChange={updateServiceFilter}
        />
      )}

      <AssetLayoutControls
        layout={layout}
        columns={columns}
        onLayoutChange={setLayout}
        onColumnsChange={setColumns}
      />

      <AssetSelectionToolbar
        asset={selectedAsset}
        onClear={() => setSelectedAssetId(null)}
      />

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {assets === null ? (
        <div
          className={assetLayoutClass(layout, columns)}
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className={
                layout === "grid"
                  ? "aspect-[4/3] w-full rounded-xl"
                  : "h-32 w-full rounded-xl"
              }
            />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <FolderEmptyIcon />
          </div>

          <p className="mt-4 text-sm font-medium">
            No assets found
          </p>

          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            There are no assets matching this filter in this project yet.
          </p>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-4"
          >
            <Link href="/app/ai-image-generator">
              Start a render
            </Link>
          </Button>
        </div>
      ) : (
        <div
          className={assetLayoutClass(layout, columns)}
        >
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              layout={layout}
              selected={selectedAssetId === asset.id}
              onSelect={() =>
                setSelectedAssetId((current) => current === asset.id ? null : asset.id)
              }
              onChanged={() =>
                void fetchProject(
                  filter,
                  serviceFilter,
                )
              }
            />
          ))}
        </div>
      )}
    </main>
  );
}

function FolderEmptyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path
        d="M3.5 6.5h6l1.6 2h9.4v8.8a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V6.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}