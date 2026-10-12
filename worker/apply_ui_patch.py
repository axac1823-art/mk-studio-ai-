from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMPONENTS = ROOT / "updated_components"

# This patch is intentionally presentation-only. It leaves API handlers, worker
# logic, model routing, credits, and generation payloads untouched.

def replace_exact(text: str, old: str, new: str, label: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise ValueError(f"{label}: expected {expected} match(es), found {count}")
    return text.replace(old, new, expected)


def main() -> int:
    parser = argparse.ArgumentParser(description="Apply Renderuim image-tools UI polish locally.")
    parser.add_argument("project", nargs="?", default=".", help="Path to the repository root (contains web/)")
    parser.add_argument("--dry-run", action="store_true", help="Validate expected source anchors without writing files")
    args = parser.parse_args()
    repo = Path(args.project).expanduser().resolve()
    web = repo / "web"
    workspace_path = web / "components/studio/image-studio-workspace.tsx"
    if not workspace_path.is_file():
        print(f"Could not find {workspace_path}. Run this script from the repository root or pass the path.", file=sys.stderr)
        return 2

    # Read every target first, prepare all edits in memory, and validate anchors
    # before the first write so a branch/version mismatch cannot half-patch files.
    targets = {
        "web/components/studio/studio-shell.tsx": (COMPONENTS / "studio-shell.tsx").read_text(encoding="utf-8"),
        "web/components/studio/image-feature-panel.tsx": (COMPONENTS / "image-feature-panel.tsx").read_text(encoding="utf-8"),
        "web/components/studio/references-panel.tsx": (COMPONENTS / "references-panel.tsx").read_text(encoding="utf-8"),
        "web/components/studio/scene-type-picker.tsx": (COMPONENTS / "scene-type-picker.tsx").read_text(encoding="utf-8"),
        "web/components/studio/preset-grid.tsx": (COMPONENTS / "preset-grid.tsx").read_text(encoding="utf-8"),
        "web/components/studio/settings-accordion.tsx": (COMPONENTS / "settings-accordion.tsx").read_text(encoding="utf-8"),
        "web/components/studio/scene-details.tsx": (COMPONENTS / "scene-details.tsx").read_text(encoding="utf-8"),
    }

    # Feature-specific page copy and component bindings.
    path = "web/components/studio/image-studio-workspace.tsx"
    text = (repo / path).read_text(encoding="utf-8")
    text = replace_exact(text,
        'const IMAGE_UPLOAD_COPY: Partial<Record<StudioTab, { title: string; description: string; ariaLabel: string }>> = {',
        '''const FEATURE_PRESENTATION: Record<StudioTab, {
  subtitle: string;
  panelTitle: string;
  panelDescription: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  descriptionHelperText: string;
}> = {
  text_to_image: {
    subtitle: "Create a new architectural concept from a clear written brief.",
    panelTitle: "Creative brief",
    panelDescription: "Set the design direction before choosing output settings.",
    descriptionLabel: "Design brief",
    descriptionPlaceholder: "Describe the building or space, its form, materials, composition, lighting and mood…",
    descriptionHelperText: "A focused brief helps guide the first concept.",
  },
  print_render: {
    subtitle: "Turn a 3D viewport capture into a presentation-ready architectural render.",
    panelTitle: "Render setup",
    panelDescription: "Start with your source, then refine the scene and its visual finish.",
    descriptionLabel: "Design notes",
    descriptionPlaceholder: "What should be refined in the render? Mention visible finishes, planting, furniture or presentation details…",
    descriptionHelperText: "Choose the scene, material and lighting first; use notes for additional details.",
  },
  mood_swap: {
    subtitle: "Explore new light, weather and atmosphere while retaining the same scene.",
    panelTitle: "Source & atmosphere",
    panelDescription: "Choose the source render, select an atmosphere, then refine the direction.",
    descriptionLabel: "Atmosphere notes",
    descriptionPlaceholder: "Describe the desired time of day, weather, shadows or overall mood…",
    descriptionHelperText: "The atmosphere preset sets the starting direction; notes are optional.",
  },
  exterior_to_interior: {
    subtitle: "Explore an interior direction informed by your architectural reference.",
    panelTitle: "Interior direction",
    panelDescription: "Provide the reference and describe the interior you want to explore.",
    descriptionLabel: "Interior direction",
    descriptionPlaceholder: "Describe interior materials, spatial character, furniture, lighting and finishes…",
    descriptionHelperText: "Focus on the interior character you want to develop.",
  },
  plan_to_render: {
    subtitle: "Turn a 2D floor plan into a furnished interior or landscaped exterior concept.",
    panelTitle: "Plan & design direction",
    panelDescription: "Add the floor plan, choose a render direction and describe important details.",
    descriptionLabel: "Design direction",
    descriptionPlaceholder: "Mention finishes, furniture, landscape elements or details that should guide the render…",
    descriptionHelperText: "Keep important room relationships and circulation clear in your notes.",
  },
  multi_angle: {
    subtitle: "Explore another camera view of the same architectural design.",
    panelTitle: "Source & camera",
    panelDescription: "Choose the source image and the viewing angle for the next image.",
    descriptionLabel: "View notes",
    descriptionPlaceholder: "Describe the framing, focal point or architectural detail to emphasize…",
    descriptionHelperText: "Use the camera preset to set the angle, then add any emphasis here.",
  },
  image_extender: {
    subtitle: "Expand the image beyond its original frame to create more room in the composition.",
    panelTitle: "Source & extension",
    panelDescription: "Choose the image and the direction in which the composition should grow.",
    descriptionLabel: "Extension notes",
    descriptionPlaceholder: "Describe what should continue beyond the current image edges…",
    descriptionHelperText: "The extension direction is selected above; notes can guide the surrounding context.",
  },
  variations: {
    subtitle: "Explore alternate visual directions while keeping the source as the starting point.",
    panelTitle: "Source & variations",
    panelDescription: "Choose an image and describe what should stay consistent or change.",
    descriptionLabel: "Variation direction",
    descriptionPlaceholder: "What should stay consistent, and what may vary across the new versions?",
    descriptionHelperText: "State the elements that must be preserved before describing creative changes.",
  },
  background_remover: {
    subtitle: "Isolate the subject with a clean background removal workflow.",
    panelTitle: "Source image",
    panelDescription: "Choose the image whose background you want to remove.",
    descriptionLabel: "Description",
    descriptionPlaceholder: "",
    descriptionHelperText: "",
  },
  upscale: {
    subtitle: "Increase image resolution and optionally enhance fine details.",
    panelTitle: "Upscale settings",
    panelDescription: "Choose a source image, scale factor and enhancement setting.",
    descriptionLabel: "Description",
    descriptionPlaceholder: "",
    descriptionHelperText: "",
  },
};

const IMAGE_UPLOAD_COPY: Partial<Record<StudioTab, { title: string; description: string; ariaLabel: string }>> = {''',
        "insert service-specific presentation metadata")
    text = replace_exact(text,
        '  const title = STUDIO_TABS.find((t) => t.id === tab)?.label ?? "Image Studio";\n  const uploadCopy = IMAGE_UPLOAD_COPY[tab] ?? IMAGE_UPLOAD_COPY.variations!;',
        '  const title = STUDIO_TABS.find((t) => t.id === tab)?.label ?? "Image Studio";\n  const presentation = FEATURE_PRESENTATION[tab];\n  const uploadCopy = IMAGE_UPLOAD_COPY[tab] ?? IMAGE_UPLOAD_COPY.variations!;',
        "bind current feature presentation")
    text = replace_exact(text,
        '''          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
              {tab !== "upscale" && result.status === "busy" && <Badge variant="secondary">Generating</Badge>}
            </div>
            <div className="flex w-full items-center gap-3 sm:w-auto sm:justify-end">
              <span className="shrink-0 text-xs font-medium text-muted-foreground">Project</span>
              <div className="w-full min-w-0 sm:w-64">
                <ProjectPicker
                  projects={projects}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  onCreateProject={handleCreateProject}
                />
              </div>
            </div>
          </div>''',
        '''          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <span>Image tools</span>
                <span aria-hidden="true" className="text-border">/</span>
                <span>{title}</span>
                {tab !== "upscale" && result.status === "busy" && (
                  <Badge variant="secondary" className="normal-case tracking-normal">Generating</Badge>
                )}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">{presentation.subtitle}</p>
            </div>
            <div className="flex w-full items-center gap-3 rounded-xl border border-border/70 bg-background p-3 lg:mt-1 lg:w-auto lg:min-w-[260px]">
              <div className="min-w-0 flex-1">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Project</span>
                <ProjectPicker
                  projects={projects}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  onCreateProject={handleCreateProject}
                />
              </div>
            </div>
          </div>''',
        "refine workspace heading")
    text = replace_exact(text,
        '''<Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Working Input</CardTitle>
            <CardDescription>Choose a source and shape the result.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">''',
        '''<Card className="border-border/70 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{presentation.panelTitle}</CardTitle>
            <CardDescription className="leading-5">{presentation.panelDescription}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">''',
        "make panel title service-specific")
    text = replace_exact(text,
        '''<SettingsAccordion
                  label="Design"
                  materialId={materialId}
                  lightingId={lightingId}
                  onMaterialChange={setMaterialId}
                  onLightingChange={setLightingId}
                />
                <SceneDetails value={sceneDetails} onChange={setSceneDetails} />''',
        '''<SettingsAccordion
                  label="Advanced design"
                  materialId={materialId}
                  lightingId={lightingId}
                  onMaterialChange={setMaterialId}
                  onLightingChange={setLightingId}
                />
                <SceneDetails
                  value={sceneDetails}
                  onChange={setSceneDetails}
                  label={presentation.descriptionLabel}
                  placeholder={presentation.descriptionPlaceholder}
                  helperText={presentation.descriptionHelperText}
                />''',
        "refine render design settings")
    text = replace_exact(text,
        '''                sceneDetails={simpleTabs[tab].sceneDetails}
                onSceneDetailsChange={(value) => updateSimpleTab(tab, { sceneDetails: value })}
                descriptionRequired={tab === "text_to_image"}''',
        '''                sceneDetails={simpleTabs[tab].sceneDetails}
                onSceneDetailsChange={(value) => updateSimpleTab(tab, { sceneDetails: value })}
                descriptionLabel={presentation.descriptionLabel}
                descriptionPlaceholder={presentation.descriptionPlaceholder}
                descriptionHelperText={presentation.descriptionHelperText}
                showDescription={tab !== "background_remover"}
                descriptionRequired={tab === "text_to_image"}''',
        "configure feature-specific description UI")
    targets[path] = text

    # Polished result stage but the actual comparison/result logic remains intact.
    path = "web/components/studio/result-panel.tsx"
    text = (repo / path).read_text(encoding="utf-8")
    replacements = [
        ('import { Download, Expand, Loader2, Minimize2, MoreHorizontal } from "lucide-react";',
         'import { Download, Expand, ImagePlus, Loader2, Minimize2, MoreHorizontal } from "lucide-react";', "result icon import"),
        ('<Card className="min-w-0 overflow-hidden">', '<Card className="min-w-0 overflow-hidden border-border/70 shadow-sm">', "result card style"),
        ('{result.status === "done" && result.kind === "video" ? "Video Preview" : result.status === "done" ? "Result" : "Preview"}',
         '{result.status === "done" && result.kind === "video" ? "Video result" : "Result"}', "result header label"),
        ('<CardContent className="flex min-w-0 flex-col gap-3">', '<CardContent className="flex min-w-0 flex-col gap-4">', "result spacing"),
        ('className="flex aspect-[4/3] min-h-[320px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]"',
         'className="flex aspect-[4/3] min-h-[360px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-destructive/25 bg-destructive/[0.035] p-6 text-center sm:min-h-[440px] lg:min-h-[520px]"', "result error stage"),
        ('className="flex aspect-[4/3] min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-lg border bg-muted/20 p-4 sm:min-h-[400px] lg:min-h-[480px]"',
         'className="flex aspect-[4/3] min-h-[360px] w-full flex-col items-center justify-center gap-4 rounded-xl border border-border/70 bg-muted/15 p-5 sm:min-h-[440px] lg:min-h-[520px]"', "result loading stage"),
        ('''<div className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]">
              <p className="text-sm text-muted-foreground">Your result will appear here.</p>
            </div>''',
         '''<div className="flex aspect-[4/3] min-h-[360px] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/10 p-8 text-center sm:min-h-[440px] lg:min-h-[520px]">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border/70 bg-background text-muted-foreground shadow-sm">
                <ImagePlus className="h-5 w-5" />
              </span>
              <div className="flex max-w-sm flex-col gap-1.5">
                <p className="text-sm font-semibold">Your result will appear here</p>
                <p className="text-xs leading-5 text-muted-foreground">Choose your source and design direction, then generate to see the output here.</p>
              </div>
            </div>''', "result empty state"),
        ('className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/20 p-1 sm:min-h-[400px] lg:min-h-[480px]"',
         'className="flex aspect-[4/3] min-h-[360px] w-full items-center justify-center overflow-hidden rounded-xl border border-border/70 bg-muted/10 p-1.5 sm:min-h-[440px] lg:min-h-[520px]"', "result image stage"),
        ('"h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",',
         '"h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",', "result thumbnail size"),
        ('className="flex aspect-[4/3] min-h-[320px] w-full items-center justify-center rounded-lg border border-dashed bg-muted/20 p-6 text-center sm:min-h-[400px] lg:min-h-[480px]"',
         'className="flex aspect-[4/3] min-h-[360px] w-full items-center justify-center rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center sm:min-h-[440px] lg:min-h-[520px]"', "result fallback stage"),
    ]
    for old, new, label in replacements:
        text = replace_exact(text, old, new, label)
    targets[path] = text

    # Shared generation bar and upload affordances.
    path = "web/components/studio/generation-controls.tsx"
    text = (repo / path).read_text(encoding="utf-8")
    text = replace_exact(text,
        'className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"',
        'className="sticky bottom-0 z-10 -mx-4 border-t border-border/70 bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl sm:-mx-6 sm:px-6"',
        "generation bar style")
    text = replace_exact(text, 'className="h-10 w-full sm:w-auto"', 'className="h-11 w-full shadow-sm sm:min-w-[190px] sm:w-auto"', "generate action size")
    targets[path] = text

    path = "web/components/upload-dropzone.tsx"
    text = (repo / path).read_text(encoding="utf-8")
    text = replace_exact(text,
        '"flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors",\n        isDragging ? "border-primary bg-accent" : previewUrl ? "border-primary/40 bg-background" : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/50"',
        '"flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",\n        isDragging\n          ? "border-primary bg-primary/[0.06] ring-2 ring-primary/10"\n          : previewUrl\n            ? "border-primary/40 bg-background"\n            : "border-border bg-muted/10 hover:border-primary/50 hover:bg-muted/25"',
        "upload surface style")
    text = replace_exact(text, 'className="flex flex-col items-center gap-2 p-6 text-center"', 'className="flex flex-col items-center gap-3 p-6 text-center"', "upload empty state spacing")
    text = replace_exact(text, '<Icon className="h-8 w-8 text-muted-foreground" />', '<span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background text-muted-foreground shadow-sm"><Icon className="h-5 w-5" /></span>', "upload icon treatment")
    targets[path] = text

    # Upscale is a dedicated panel rather than the generic feature panel, so polish its local spacing too.
    path = "web/components/studio/upscale-panel.tsx"
    text = (repo / path).read_text(encoding="utf-8")
    text = replace_exact(text, '<div className="flex flex-col gap-4">', '<div className="flex flex-col gap-6">', "upscale panel spacing")
    text = replace_exact(text,
        '<div className="flex flex-col gap-2">\n        <span className="text-sm font-medium">Source image</span>',
        '<div className="flex flex-col gap-2.5">\n        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Source image</span>',
        "upscale source label")
    text = replace_exact(text, '<div className="flex items-center justify-between gap-3 rounded-lg border p-3">', '<div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/10 p-3.5">', "upscale enhancement panel")
    text = replace_exact(text, '<Button onClick={onGenerate} disabled={!canGenerate} className="w-full">', '<Button onClick={onGenerate} disabled={!canGenerate} className="h-11 w-full shadow-sm">', "upscale action button")
    text = replace_exact(text, '"flex-1 px-3 py-1.5 text-xs font-medium transition-colors",', '"flex-1 px-3 py-2.5 text-xs font-semibold transition-colors",', "upscale scale controls")
    targets[path] = text

    # Keep the dedicated Image Generator page distinct; the combined Studio route still has tabs.
    path = "web/app/app/image-generator/page.tsx"
    text = (repo / path).read_text(encoding="utf-8")
    text = replace_exact(text, 'return <ImageStudioWorkspace feature="text_to_image" showTabs />;', 'return <ImageStudioWorkspace feature="text_to_image" />;', "dedicated image generator route")
    targets[path] = text

    # The UI uses a 1000-character brief limit, as specified for the workspace.
    path = "web/lib/presets.ts"
    text = (repo / path).read_text(encoding="utf-8")
    text = replace_exact(text, 'export const SCENE_DETAILS_MAX = 10_000;', 'export const SCENE_DETAILS_MAX = 1_000;', "description character limit")
    targets[path] = text

    if args.dry_run:
        print("Dry run passed: all expected source anchors are present.")
        print("Files that would be updated:")
        for relative in sorted(targets):
            print(f"  - {relative}")
        return 0

    # Back up every target before writing, then write the validated patch as one set.
    backup_dir = repo / f"_renderuim_ui_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    changed_paths = sorted(targets.keys())
    try:
        for relative in changed_paths:
            source = repo / relative
            if not source.is_file():
                raise FileNotFoundError(f"Expected source file was not found: {source}")
            backup = backup_dir / relative
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, backup)
        for relative, content in targets.items():
            dest = repo / relative
            dest.write_text(content, encoding="utf-8", newline="\n")
        # Copy complete replacement components into the project, retaining backups for rollback.
        for relative, content in targets.items():
            pass
    except Exception:
        # Restore all original files if a write fails in the middle.
        for relative in changed_paths:
            backup = backup_dir / relative
            if backup.is_file():
                shutil.copy2(backup, repo / relative)
        print(f"Patch failed; original files restored from {backup_dir}", file=sys.stderr)
        raise

    print("Renderuim image-tool UI patch applied locally.")
    print(f"Backup created at: {backup_dir}")
    print("Updated files:")
    for relative in changed_paths:
        print(f"  - {relative}")
    print("\nNext: cd web; npm run build. This patch has not changed API, worker, model routing, or credit logic.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1)
