Image2 Batch 1 — Immutable Role Metadata, Prompt Conflict, Base-only Auto, EXIF

Prepared against the source implementation reviewed at branch `codex`, commit
`1074dd372d306611e5f0c4c7b656e1e185eaf21a`.

The patch runner is anchor-checked rather than hard-locked to one HEAD SHA. The
latest supplied local status report showed branch `codex` at
`73919f67dc810acbacc5f65bd1d85807f56b27b2` (ahead 1), with no source changes in
the four target files. The runner prints the actual local HEAD and stops before
writing if a target file is modified/staged/untracked or an expected source
anchor differs.

WHAT CHANGES

1. `worker/catalog.py`
   - `normalize_image2_reference_roles()` uses valid saved `referenceRoles`
     first. Missing/invalid legacy metadata defaults to `element`.
   - Prompt text no longer mutates the returned role manifest.
   - `image2_reference_role_conflicts()` separately checks explicit role
     assignments in `sceneDetails`; it reports a mismatch without changing
     the saved role. The detector covers the explicit English/Arabic patterns
     exercised by the regression tests. It is pattern-based, not a general
     natural-language semantic classifier.
   - Negative instructions (for example, “Do not use @img1 as an Element”)
     are not treated as role assignments. English role labels with articles
     such as “an Element” are recognized.
   - Multiple explicit role assignments to one tag, such as
     “Use @img1 as Base and Element”, are treated as a conflict.
   - `image2_frame_reference()` accepts exactly one saved `base` role. It does
     not fall back to Primary Image or Element. Multiple Base references or an
     empty Base fail Auto explicitly.
   - Adds typed `Image2RoleConflictError` and `Image2AutoFrameError` errors.

2. `worker/workflows/image_render.py`
   - Checks explicit Role Metadata conflicts before building the provider prompt
     or calling any provider.
   - Resolves the output ratio once through `_resolve_image2_aspect_ratio()`:
       * explicit ratio: returned unchanged;
       * Auto + exactly one Base: infer from Base;
       * Auto without Base: `4:3`;
       * explicitly selected Magic Hour text-only Generator with no images: `1:1`;
       * multiple/empty/unreadable Base: explicit error, no silent fallback.
   - Auto measurement uses `ImageOps.exif_transpose()` in memory so EXIF
     orientations 6 and 8 produce the visual/logical dimensions.
   - The EXIF-adjusted image is used only for dimension measurement. The
     original bytes/data URI are not saved, rewritten, resized or uploaded as a
     transformed copy.
   - No provider Adapter, output validator, or fallback policy is rewritten.

3. `worker/workflows/common.py`
   - Returns clear client-facing messages for Role Conflict and Auto/Base errors
     rather than the generic provider error message.

4. `worker/tests/test_image2_role_prompt_regressions.py`
   - Replaces tests that expected Prompt to override saved metadata.
   - Adds saved-role precedence, explicit English/Arabic conflict, negative
     instruction, legacy Element default, pre-provider blocking, Base-only Auto,
     multiple/missing Base, explicit-ratio preservation, Magic Hour text-only
     default, unreadable Base, and EXIF orientation 6/8 tests.
   - Confirms source bytes remain identical after EXIF dimension inspection.

NOT CHANGED
- `worker/providers/openai.py`, `google.py`, `bfl.py`, `magichour.py`.
- `worker/frame_ratio.py` and its 2.5% tolerance.
- Output normalization, crop, resize, padding, and transformer paths.
- Video, Voice, 3D, or other workflows.
- `README.md`, `web/.next-dev`, or other generated build files.
- Git history: no checkout/reset/clean/commit/push is performed.

PRIMARY IMAGE NOTE

In this request schema, the separate `imageUrl` primary image has no saved
`primaryImageRole` field. Therefore it does not become the Auto Base. If the
user needs that same image to define Auto framing, attach it as a tagged
reference and save its role as `base`. Adding a new Primary Image role control
is not part of this batch.

APPLY (PowerShell)

1. Place `apply_image2_batch1.py` in the repository root.
2. From the repository root, run a dry run first:

   `py -3 .\apply_image2_batch1.py --root .`

3. Review the printed branch, HEAD, target file list and anchor validation. If
   it succeeds and lists exactly the four expected target files, apply:

   `py -3 .\apply_image2_batch1.py --root . --apply`

The runner refuses to overwrite modified, staged or untracked target files,
validates all replacement anchors and parses every transformed Python file
before writing. It stores byte-for-byte backups outside the repository under
`%TEMP%`. It does not create a commit or push.

VERIFY (PowerShell)

From the repository root:

   `cd .\worker`
   `.\.venv\Scripts\python.exe -m pytest tests\test_image2_role_prompt_regressions.py tests\test_image2_frame_contract_preservation.py -q`

Then run the full Worker test suite and the project's normal Web type/build
checks. Do not treat a check as passed unless it completes successfully.

IMPORTANT VERIFICATION STATUS

The patch runner itself was syntax-checked in the preparation environment, and
its generated replacement snippets were parsed and the pure role-conflict
logic received five local smoke checks. The runner has NOT been run against the
user's Windows worktree, the project tests have NOT been run, and no source
file in the user's repository has been changed by this preparation. The local
`--root` dry run is the first project-specific verification step.
