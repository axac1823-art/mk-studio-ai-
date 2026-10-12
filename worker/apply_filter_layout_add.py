from __future__ import annotations

import argparse
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

PATCH_ROOT = Path(__file__).resolve().parent


def replace_exact(text: str, old: str, new: str, label: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise ValueError(f"{label}: expected {expected} match(es), found {count}")
    return text.replace(old, new, expected)


def replace_regex(text: str, pattern: str, replacement: str, label: str) -> str:
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.MULTILINE)
    if count != 1:
        raise ValueError(f"{label}: expected one matching block, found {count}")
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Add Filter / Layout / Add menus to Renderuim project assets.")
    parser.add_argument("project", nargs="?", default=".", help="Repository root containing web/")
    parser.add_argument("--dry-run", action="store_true", help="Validate source anchors without writing files")
    args = parser.parse_args()
    root = Path(args.project).expanduser().resolve()
    web = root / "web"

    page_relative = "web/app/app/projects/[id]/page.tsx"
    service_relative = "web/components/projects/asset-service-filter.tsx"
    toolbar_relative = "web/components/projects/asset-library-toolbar.tsx"
    page_file = root / page_relative
    service_file = root / service_relative

    if not page_file.is_file() or not service_file.is_file():
        print(
            "Could not find the expected project-detail page or service-filter component. "
            "Run from the repository root (the directory containing web/).",
            file=sys.stderr,
        )
        return 2

    targets: dict[str, str] = {}

    # Export the existing catalogue when starting from the legacy version,
    # and accept the already-exported form so --dry-run remains repeatable.
    service_text = service_file.read_text(encoding="utf-8")
    if "export const ASSET_SERVICE_OPTIONS" not in service_text:
        service_text = replace_exact(service_text, "interface ServiceOption {", "export interface ServiceOption {", "export ServiceOption")
        service_text = replace_exact(service_text, "const SERVICES: ServiceOption[] = [", "export const ASSET_SERVICE_OPTIONS: ServiceOption[] = [", "export service catalogue")
        service_text = replace_exact(service_text, "const options = SERVICES.filter(", "const options = ASSET_SERVICE_OPTIONS.filter(", "reuse exported service catalogue")
    targets[service_relative] = service_text

    # Use the prepared component if present, or the already-copied project file.
    prepared_toolbar = PATCH_ROOT / "updated_components/asset-library-toolbar.tsx"
    existing_toolbar = root / toolbar_relative
    toolbar_source = prepared_toolbar if prepared_toolbar.is_file() else existing_toolbar
    if not toolbar_source.is_file():
        raise FileNotFoundError(f"Toolbar component source not found: {toolbar_source}")
    targets[toolbar_relative] = toolbar_source.read_text(encoding="utf-8")

    page_text = page_file.read_text(encoding="utf-8")
    page_text = replace_exact(
        page_text,
        '''import {
  AssetLayoutControls,
  assetLayoutClass,
} from "@/components/projects/asset-layout-controls";
import {
  AssetServiceFilter,
} from "@/components/projects/asset-service-filter";''',
        '''import { assetLayoutClass } from "@/components/projects/asset-layout-controls";
import { AssetLibraryToolbar } from "@/components/projects/asset-library-toolbar";''',
        "replace layout/filter imports",
    )
    page_text = replace_exact(
        page_text,
        '''import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
''',
        "",
        "remove old media tabs import",
    )

    page_text = replace_regex(
        page_text,
        r"  const updateFilter = \(nextType: TypeFilter\) => \{[\s\S]*?(?=  const deleteProject = async \(\) => \{)",
        '''  const updateAssetFilters = (nextType: TypeFilter, nextService: string) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (nextType === "all") nextParams.delete("type");
    else nextParams.set("type", nextType);

    if (nextService === "all") nextParams.delete("feature");
    else nextParams.set("feature", nextService);

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

''',
        "combine media and service filters",
    )

    page_text = replace_regex(
        page_text,
        r"        \{\/\* Tabs \*\/\}[\s\S]*?      <\/header>",
        '''        <div className="flex justify-end border-b pb-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deleting}
            onClick={() => void deleteProject()}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete project
          </Button>
        </div>
      </header>''',
        "replace old tabs row while keeping delete action",
    )

    page_text = replace_regex(
        page_text,
        r"      \{\(filter === \"image\" \|\| filter === \"video\"\) && \([\s\S]*?(?=      \{error && \()",
        '''      <AssetLibraryToolbar
        type={filter}
        service={serviceFilter}
        layout={layout}
        columns={columns}
        onFilterChange={updateAssetFilters}
        onLayoutChange={setLayout}
        onColumnsChange={setColumns}
      />
''',
        "replace standalone filter and layout controls",
    )

    # Safety assertions: no stale references to the old handlers/components remain.
    for stale in ["updateFilter(", "updateServiceFilter", "<AssetServiceFilter", "<AssetLayoutControls", "<Tabs"]:
        if stale in page_text:
            raise ValueError(f"Old project-page reference remains after patch: {stale}")
    if "<AssetLibraryToolbar" not in page_text:
        raise ValueError("Toolbar wiring validation failed")
    if "export const ASSET_SERVICE_OPTIONS" not in targets[service_relative]:
        raise ValueError("The service catalogue export was not created")
    targets[page_relative] = page_text

    if args.dry_run:
        print("Dry run passed. Files that would be updated:")
        for relative in sorted(targets):
            print(f"  - {relative}" + (" (new)" if not (root / relative).exists() else ""))
        print("Folder is intentionally disabled because there is no persistent folder feature in the existing data model.")
        return 0

    backup_dir = root / f"_renderuim_filter_layout_add_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    backup_dir.mkdir(parents=True, exist_ok=False)
    try:
        # Back up existing files, then write. New files are removed on rollback.
        for relative in targets:
            source = root / relative
            if source.exists():
                backup = backup_dir / relative
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, backup)
        for relative, content in targets.items():
            destination = root / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_text(content, encoding="utf-8", newline="\n")
    except Exception:
        for relative in targets:
            backup = backup_dir / relative
            destination = root / relative
            if backup.exists():
                shutil.copy2(backup, destination)
            elif destination.exists():
                destination.unlink()
        print(f"Patch failed; originals restored from {backup_dir}", file=sys.stderr)
        raise

    print("Filter / Layout / Add menus applied locally.")
    print(f"Backup created: {backup_dir}")
    print("Updated files:")
    for relative in sorted(targets):
        print(f"  - {relative}" + (" (new)" if relative == toolbar_relative else ""))
    print("Next: cd web; npm run build")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Patch validation/application error: {exc}", file=sys.stderr)
        raise SystemExit(1)
