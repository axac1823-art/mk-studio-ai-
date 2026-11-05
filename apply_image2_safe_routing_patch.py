from __future__ import annotations

import argparse
import hashlib
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

EXPECTED_HEAD = "e2fc06890a3fba7f61d4b1dbfb11511fbcba94b2"


def git_output(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args], cwd=root, text=True, capture_output=True, check=False
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or f"git {' '.join(args)} failed")
    return result.stdout.strip()


def replace_once(text: str, old: str, new: str, *, path: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(
            f"{path}: expected one exact match, found {count}; no files were changed."
        )
    return text.replace(old, new, 1)


def edit_file(root: Path, rel: str, edits: list[tuple[str, str]]) -> tuple[bytes, bytes]:
    path = root / rel
    if not path.is_file():
        raise RuntimeError(f"Missing required file: {rel}")
    original_bytes = path.read_bytes()
    try:
        original_text = original_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise RuntimeError(f"{rel} is not UTF-8: {exc}") from exc
    newline = "\r\n" if b"\r\n" in original_bytes else "\n"
    text = original_text.replace("\r\n", "\n")
    for old, new in edits:
        text = replace_once(text, old, new, path=rel)
    new_bytes = text.replace("\n", newline).encode("utf-8")
    return original_bytes, new_bytes


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Apply the Image2 frame-validation/Assets and BFL text-only safety patch. "
            "Dry-run is the default; pass --apply to write files."
        )
    )
    parser.add_argument("--root", default=".", help="Repository root (default: current directory)")
    parser.add_argument("--apply", action="store_true", help="Write the changes after all checks pass")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    head = git_output(root, "rev-parse", "HEAD")
    branch = git_output(root, "branch", "--show-current")
    if head != EXPECTED_HEAD:
        raise RuntimeError(
            "Wrong source revision. This patch is prepared for "
            f"{EXPECTED_HEAD[:7]}, but this worktree is at {head[:7]}. "
            "No files were changed."
        )
    if branch != "codex":
        raise RuntimeError(
            f"Expected branch 'codex', found '{branch}'. No files were changed."
        )

    edits: dict[str, list[tuple[str, str]]] = {}

    # 1) Shared engine: make output-validation failures non-retriable only when
    # the Image2 workflow explicitly opts in. Other workflows keep old behavior.
    edits["worker/workflows/engine.py"] = [
        (
            """class AllModelsFailedError(Exception):
    \"\"\"Levée quand tous les candidats d'une feature ont échoué : la route
    traduit en message GÉNÉRIQUE côté client (la trace garde le détail).\"\"\"

    def __init__(self, feature: str, attempts: list[dict]):
        super().__init__(f'All models failed for feature \"{feature}\"')
        self.feature = feature
        self.attempts = attempts


""",
            """class AllModelsFailedError(Exception):
    \"\"\"Levée quand tous les candidats d'une feature ont échoué : la route
    traduit en message GÉNÉRIQUE côté client (la trace garde le détail).\"\"\"

    def __init__(self, feature: str, attempts: list[dict]):
        super().__init__(f'All models failed for feature \"{feature}\"')
        self.feature = feature
        self.attempts = attempts


class OutputValidationError(Exception):
    \"\"\"A provider returned an image, but the workflow rejected its output.\"\"\"

    def __init__(
        self,
        feature: str,
        candidate: Candidate,
        output_urls: list[str],
        validation_error: Exception,
        attempts: list[dict],
    ):
        super().__init__(str(validation_error))
        self.feature = feature
        self.candidate = candidate
        self.output_urls = list(output_urls)
        self.validation_error = validation_error
        self.attempts = attempts
        self.saved_asset_count = 0


""",
        ),
        (
            """    output_validator=None,
    output_transformer=None,
) -> dict:
""",
            """    output_validator=None,
    output_transformer=None,
    stop_on_output_validation_error: bool = False,
) -> dict:
""",
        ),
        (
            """            if output_validator is not None:
                output_validator(output_urls, candidate)
""",
            """            if output_validator is not None:
                try:
                    output_validator(output_urls, candidate)
                except Exception as validation_err:
                    if not stop_on_output_validation_error:
                        raise
                    attempts.append(
                        {
                            \"candidateKey\": candidate.key,
                            \"ok\": False,
                            \"phase\": \"output_validation\",
                            \"latencyMs\": int((time.monotonic() - started) * 1000),
                            \"error\": str(validation_err),
                        }
                    )
                    raise OutputValidationError(
                        feature,
                        candidate,
                        output_urls,
                        validation_err,
                        attempts.copy(),
                    ) from validation_err
""",
        ),
        (
            """        except Exception as err:  # noqa: BLE001 — toute erreur = fallback
            # L'erreur réelle reste dans la trace serveur, jamais chez le client.
""",
            """        except OutputValidationError:
            # Image2 has already received a provider output: do not spend on
            # another provider merely because the output contract rejected it.
            raise
        except Exception as err:  # noqa: BLE001 — toute erreur = fallback
            # L'erreur réelle reste dans la trace serveur, jamais chez le client.
""",
        ),
    ]

    # 2) Keep the 2.5% contract, but report the exact measured deviation.
    edits["worker/frame_ratio.py"] = [
        (
            """            raise ValueError(
                f\"Output image {index} returned {width}x{height} ({actual:.4f}:1), \"
                f\"not the requested {aspect_ratio} frame.\"
            )
""",
            """            raise ValueError(
                f\"Output image {index} returned {width}x{height} ({actual:.4f}:1), \"
                f\"not the requested {aspect_ratio} frame; deviation is {deviation * 100:.2f}%, \"
                f\"which exceeds the allowed {tolerance * 100:.2f}% tolerance.\"
            )
""",
        ),
    ]

    # 3) Expose an Image2-only input-image capability; BFL FLUX1.1 Pro/Dev
    # are text-only for this workflow until a documented image-edit route is used.
    edits["worker/catalog.py"] = [
        (
            """    supports_style_reference: bool = False
    # Current text-to-image adapters expose approximately 1K output only.
""",
            """    supports_style_reference: bool = False
    # Whether this candidate's actual Image2 adapter accepts input images.
    supports_image_input: bool = True
    # Current text-to-image adapters expose approximately 1K output only.
""",
        ),
        (
            """        if c.max_identity_objects is not None:
            item[\"maxIdentityObjects\"] = c.max_identity_objects
""",
            """        if feature == \"text_to_image\":
            item[\"supportsImageInput\"] = c.supports_image_input
        if c.max_identity_objects is not None:
            item[\"maxIdentityObjects\"] = c.max_identity_objects
""",
        ),
        (
            """        extract_image_urls,
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=1,
        image2_identity_priority=40,
""",
            """        extract_image_urls,
        supports_image_input=False,
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=1,
        image2_identity_priority=40,
""",
        ),
        (
            """        extract_image_urls,
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=1,
        image2_identity_priority=50,
""",
            """        extract_image_urls,
        supports_image_input=False,
        frame_ratios=IMAGE2_FRAME_RATIOS,
        max_identity_objects=1,
        image2_identity_priority=50,
""",
        ),
    ]

    # 4) Enforce the same BFL capability on the worker, including manual model selection.
    edits["worker/workflows/image_render.py"] = [
        (
            """from workflows.engine import (
    execute_with_fallback,
    order_candidates,
    order_text_to_image_candidates,
)
""",
            """from workflows.engine import (
    OutputValidationError,
    execute_with_fallback,
    order_candidates,
    order_text_to_image_candidates,
)
""",
        ),
        (
            """                input_count = len(text_to_image_images(input_))
                identity_count = image2_identity_object_count(input_)

                feature_candidates = [
                    candidate
                    for candidate in feature_candidates
                    if candidate.max_references >= input_count
""",
            """                input_count = len(text_to_image_images(input_))
                identity_count = image2_identity_object_count(input_)
                selected_model = input_.get(\"model\")
                explicitly_selected_candidate = next(
                    (
                        candidate
                        for candidate in feature_candidates
                        if candidate.key == selected_model
                    ),
                    None,
                )
                if (
                    input_count > 0
                    and explicitly_selected_candidate is not None
                    and not explicitly_selected_candidate.supports_image_input
                ):
                    raise ValueError(
                        f\"{explicitly_selected_candidate.name} is text-only in Image2 and cannot accept image references. \"
                        \"Choose another model or remove the input images.\"
                    )

                feature_candidates = [
                    candidate
                    for candidate in feature_candidates
                    if (input_count == 0 or candidate.supports_image_input)
                    and candidate.max_references >= input_count
""",
        ),
        (
            """                selected_model = input_.get(\"model\")
                if not selected_model or selected_model == \"auto\":
""",
            """                if not selected_model or selected_model == \"auto\":
""",
        ),
        (
            """                    endpoint = "not_applicable"
                    if candidate.provider == "magichour":
                        endpoint = (
                            "ai-image-editor"
                            if image_count
                            else "ai-image-generator"
                        )
                    validate_image_output_frame(
""",
            """                    endpoint = "not_applicable"
                    if candidate.provider == "magichour":
                        endpoint = (
                            "POST /v1/ai-image-editor"
                            if image_count
                            else "POST /v1/ai-image-generator"
                        )
                    elif candidate.provider == "openai":
                        endpoint = (
                            "POST /v1/images/edits"
                            if image_count
                            else "POST /v1/images/generations"
                        )
                    elif candidate.provider == "google":
                        endpoint = f"POST /v1beta/models/{candidate.model_id}:generateContent"
                    elif candidate.provider == "bfl":
                        endpoint = f"POST /v1/{candidate.model_id}"
                    validate_image_output_frame(
""",
        ),
        (
            """            outcome = execute_with_fallback(
                feature,
                candidates,
                req,
                output_validator=output_validator,
            )
""",
            """            outcome = execute_with_fallback(
                feature,
                candidates,
                req,
                output_validator=output_validator,
                stop_on_output_validation_error=(feature == \"text_to_image\"),
            )
""",
        ),
        (
            """        except Exception as err:  # AllModelsFailedError incluse
            fail_job(conn, job, err)
""",
            """        except OutputValidationError as err:
            image_count = len(text_to_image_images(req))
            endpoint = \"not_applicable\"
            if err.candidate.provider == \"magichour\":
                endpoint = (
                    \"POST /v1/ai-image-editor\"
                    if image_count
                    else \"POST /v1/ai-image-generator\"
                )
            elif err.candidate.provider == \"openai\":
                endpoint = \"POST /v1/images/edits\" if image_count else \"POST /v1/images/generations\"
            elif err.candidate.provider == \"google\":
                endpoint = f\"POST /v1beta/models/{err.candidate.model_id}:generateContent\"
            elif err.candidate.provider == \"bfl\":
                endpoint = f\"POST /v1/{err.candidate.model_id}\"
            logger.exception(
                \"IMAGE2_OUTPUT_VALIDATION_FAILED job_id=%s model=%s provider=%s endpoint=%s \"
                \"expected_frame=%s returned_images=%d; traceback follows\",
                job[\"id\"],
                err.candidate.key,
                err.candidate.provider,
                endpoint,
                req.get(\"resolvedAspectRatio\") or input_.get(\"aspectRatio\") or \"4:3\",
                len(err.output_urls),
            )
            for index, output_url in enumerate(err.output_urls, start=1):
                try:
                    stored_path, _extension = store_output(output_url)
                    asset_id = insert_asset(conn, job, \"image\", stored_path)
                    err.saved_asset_count += 1
                    logger.info(
                        \"IMAGE2_REJECTED_IMAGE_SAVED job_id=%s image_index=%d asset_id=%s storage_path=%s\",
                        job[\"id\"],
                        index,
                        asset_id,
                        stored_path,
                    )
                except Exception:
                    logger.exception(
                        \"IMAGE2_REJECTED_IMAGE_SAVE_FAILED job_id=%s image_index=%d; traceback follows\",
                        job[\"id\"],
                        index,
                    )
            fail_job(conn, job, err)

        except Exception as err:  # AllModelsFailedError incluse
            if feature == \"text_to_image\":
                logger.exception(
                    \"IMAGE2_WORKFLOW_FAILED job_id=%s feature=%s; traceback follows\",
                    job[\"id\"],
                    feature,
                )
            fail_job(conn, job, err)
""",
        ),
    ]

    # 5) Preserve the generated-but-rejected image in Assets and give the user
    # a useful failure message without marking the generation successful or billing.
    edits["worker/workflows/common.py"] = [
        (
            """from workflows.engine import AllModelsFailedError
""",
            """from workflows.engine import AllModelsFailedError, OutputValidationError
""",
        ),
        (
            """    if isinstance(err, AllModelsFailedError):
        errors = [str(attempt.get(\"error\") or \"\").lower() for attempt in err.attempts]
""",
            """    if isinstance(err, OutputValidationError):
        if err.saved_asset_count > 0:
            return (
                f\"Image frame validation failed: {err}. The rejected image was saved to Assets; \"
                \"the generation remains failed because its frame does not match the requested ratio.\"
            )
        return (
            f\"Image frame validation failed: {err}. The generated image could not be saved to Assets; \"
            \"check the worker terminal logs for the storage error.\"
        )
    if isinstance(err, AllModelsFailedError):
        errors = [str(attempt.get(\"error\") or \"\").lower() for attempt in err.attempts]
""",
        ),
        (
            """    if isinstance(err, AllModelsFailedError):
        log.error(\"job %s (%s) failed: %s\\nattempts=%s\", job[\"id\"], job.get(\"type\"), err, err.attempts)
    else:
        log.error(\"job %s (%s) failed: %s\", job[\"id\"], job.get(\"type\"), err)
""",
            """    if isinstance(err, OutputValidationError):
        log.error(
            \"job %s (%s) rejected by Image2 output validation: %s; saved_assets=%d source_file=%s\",
            job[\"id\"],
            job.get(\"type\"),
            err,
            err.saved_asset_count,
            __file__,
        )
    elif isinstance(err, AllModelsFailedError):
        log.error(\"job %s (%s) failed: %s\\nattempts=%s source_file=%s\", job[\"id\"], job.get(\"type\"), err, err.attempts, __file__)
    else:
        log.error(\"job %s (%s) failed: %s source_file=%s\", job[\"id\"], job.get(\"type\"), err, __file__)
""",
        ),
    ]

    # 6) Return failed-job preview URLs from assets already linked to this job.
    edits["web/app/api/generate/[id]/route.ts"] = [
        (
            """  if (job.status === \"failed\") {
    return NextResponse.json({
      status: \"error\",
      error: job.error_message ?? \"Generation failed, please try again.\",
    });
  }
""",
            """  if (job.status === \"failed\") {
    const isImage2Job = job.type === \"text_to_image\" || job.input?.feature === \"text_to_image\";
    const assets = isImage2Job ? await listAssetsForJob(job.id) : [];
    const rejectedImages = assets.filter((asset) => asset.type === \"image\");
    return NextResponse.json({
      status: \"error\",
      error: job.error_message ?? \"Generation failed, please try again.\",
      previewUrls: rejectedImages.map((asset) => publicUrl(asset.storage_path)),
      previewAssetIds: rejectedImages.map((asset) => asset.id),
    });
  }
""",
        ),
    ]

    # 7) Show the rejected image in Image2 beside the error; the asset also remains
    # in the project's durable Assets feed. No success status is fabricated.
    edits["web/components/studio/image2-workspace.tsx"] = [
        (
            """  const [result, setResult] = useState<ResultState>({ status: \"idle\" });
  const [lastGenerationMeta, setLastGenerationMeta] = useState<LastGenerationMeta | null>(null);
""",
            """  const [result, setResult] = useState<ResultState>({ status: \"idle\" });
  const [rejectedOutputUrls, setRejectedOutputUrls] = useState<string[]>([]);
  const [lastGenerationMeta, setLastGenerationMeta] = useState<LastGenerationMeta | null>(null);
""",
        ),
        (
            """          } else if (data.status === \"error\") {
            stopPolling();
            setResult({ status: \"idle\" });
            setError(data.error ?? \"Generation failed. Please try again.\");
""",
            """          } else if (data.status === \"error\") {
            stopPolling();
            const previewUrls = Array.isArray(data.previewUrls)
              ? data.previewUrls.filter((url: unknown): url is string => typeof url === \"string\")
              : [];
            setRejectedOutputUrls(previewUrls);
            setResult({ status: \"idle\" });
            setError(data.error ?? \"Generation failed. Please try again.\");
            if (previewUrls.length > 0) {
              setSelectedOutputIndex(0);
              void refreshAssets(selectedProjectId);
            }
""",
        ),
        (
            """    setResult({ status: \"busy\" });
    const form = new FormData();
""",
            """    setRejectedOutputUrls([]);
    setResult({ status: \"busy\" });
    const form = new FormData();
""",
        ),
        (
            """          )}
          {feedTab === \"Creations\" ? (
""",
            """          )}
          {rejectedOutputUrls.length > 0 && (
            <section
              className=\"mb-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3\"
              aria-label=\"Rejected image preview\"
            >
              <div className=\"mb-2 flex flex-wrap items-center justify-between gap-2\">
                <p className=\"text-[11px] font-semibold text-amber-100\">
                  Generated image · saved to Assets
                </p>
                <span className=\"rounded bg-amber-200/10 px-2 py-1 text-[9px] text-amber-100\">
                  Frame validation failed
                </span>
              </div>
              <div className=\"grid grid-cols-1 gap-3 sm:grid-cols-2\">
                {rejectedOutputUrls.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type=\"button\"
                    onClick={() => setZoomedImage(url)}
                    className=\"overflow-hidden rounded-lg border border-white/[0.08] bg-[#17181c] text-left\"
                    aria-label={`Open rejected image ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Generated image rejected by frame validation ${index + 1}`}
                      className=\"max-h-[420px] w-full object-contain\"
                    />
                    <span className=\"block px-2.5 py-2 text-[9px] text-[#a6a8b1]\">
                      Preserved in project Assets · not counted as a successful generation
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {feedTab === \"Creations\" ? (
""",
        ),
    ]

    # 8) Reflect BFL's text-only capability in Image2's model selector.
    edits["web/components/studio/image2-workspace.tsx"].extend(
        [
            (
                """  supportsStyleReference?: boolean;
  tiers?: string[];
""",
                """  supportsStyleReference?: boolean;
  supportsImageInput?: boolean;
  tiers?: string[];
""",
            ),
            (
                """      model.configured &&
      imageInputCount <= (model.maxReferences ?? 0) &&
""",
                """      model.configured &&
      (!imageInputCount || model.supportsImageInput !== false) &&
      imageInputCount <= (model.maxReferences ?? 0) &&
""",
            ),
            (
                """        (model) =>
          imageInputCount <= (model.maxReferences ?? 0) &&
""",
                """        (model) =>
          (!imageInputCount || model.supportsImageInput !== false) &&
          imageInputCount <= (model.maxReferences ?? 0) &&
""",
            ),
            (
                """                    const maxRefs = model.maxReferences ?? 0;
                    const fitsReferences = imageInputCount <= maxRefs;
""",
                """                    const maxRefs = model.maxReferences ?? 0;
                    const supportsImageInput = imageInputCount === 0 || model.supportsImageInput !== false;
                    const fitsReferences = supportsImageInput && imageInputCount <= maxRefs;
""",
            ),
            (
                """                              {maxRefs > 0
                                ? `${maxRefs} content images max`
                                : \"Prompt only\"}
""",
                """                              {model.supportsImageInput === false
                                ? \"Prompt only\"
                                : maxRefs > 0
                                  ? `${maxRefs} content images max`
                                  : \"Prompt only\"}
""",
            ),
            (
                """                          {!fitsReferences && (
                            <span className=\"mt-1 block text-[9px] text-rose-200\">
                              Needs fewer image inputs ({imageInputCount}{\" \"}
                              selected).
                            </span>
                          )}
""",
                """                          {!fitsReferences && (
                            <span className=\"mt-1 block text-[9px] text-rose-200\">
                              {model.supportsImageInput === false
                                ? \"Text-only model. Remove image references to use it.\"
                                : `Needs fewer image inputs (${imageInputCount} selected).`}
                            </span>
                          )}
""",
            ),
        ]
    )

    # 9) Add targeted offline regressions.
    edits["worker/tests/test_fallback.py"] = [
        (
            """from workflows.engine import AllModelsFailedError, execute_with_fallback, order_candidates
""",
            """from workflows.engine import (
    AllModelsFailedError,
    OutputValidationError,
    execute_with_fallback,
    order_candidates,
)
""",
        ),
    ]

    # Insert the regression before main() so it runs in the existing script-style suite.
    edits["worker/tests/test_fallback.py"].append(
        (
            """def main() -> None:
""",
            """def test_output_validation_failure_stops_fallback_and_keeps_provider_output() -> None:
    calls: list[str] = []
    candidates = [fake_candidate(\"a\"), fake_candidate(\"b\")]

    def reject_frame(_urls, _candidate):
        raise ValueError(\"frame mismatch: 640x448 is not 16:9\")

    caught = None
    try:
        execute_with_fallback(
            \"text_to_image\",
            candidates,
            base_request(feature=\"text_to_image\", imageUrl=None, referenceUrls=[]),
            fake_adapter([], calls),
            output_validator=reject_frame,
            stop_on_output_validation_error=True,
        )
    except OutputValidationError as exc:
        caught = exc

    check(isinstance(caught, OutputValidationError), \"output validation raises a dedicated non-retriable error\")
    check(calls == [\"fake/a\"], \"no second provider is called after a returned image fails validation\")
    check(caught is not None and caught.output_urls == [\"https://example.test/a.jpg\"], \"rejected provider output is preserved for Assets\")
    check(caught is not None and caught.candidate.key == \"a\", \"failed candidate identity is retained\")


def main() -> None:
""",
        )
    )
    # Call the dedicated regression from the existing script-style test runner.
    edits["worker/tests/test_fallback.py"].append(
        (
            """def main() -> None:
    print(\"\\n[1] Fallback : A et B échouent, C sert la génération\")
""",
            """def main() -> None:
    print(\"\\n[0] Output validation failure: keep the image and do not retry\")
    test_output_validation_failure_stops_fallback_and_keeps_provider_output()

    print(\"\\n[1] Fallback : A et B échouent, C sert la génération\")
""",
        )
    )

    edits["worker/tests/test_image2_frame_contract_preservation.py"] = [
        (
            """def test_worker_storage_image_url_is_resolved_even_when_host_is_a_lan_ip(
""",
            """def test_frame_rejection_reports_measured_deviation_and_fixed_tolerance():
    with pytest.raises(ValueError) as exc:
        validate_image_output_frame([_png_data_uri(640, 448)], "16:9")

    message = str(exc.value)
    assert "640x448" in message
    assert "deviation is" in message
    assert "19.64%" in message
    assert "2.50% tolerance" in message


def test_worker_storage_image_url_is_resolved_even_when_host_is_a_lan_ip(
""",
        ),
    ]

    edits["worker/tests/test_image2_role_prompt_regressions.py"] = [
        (
            """def test_gpt_image_25_gets_native_4k_dimensions_and_png():
""",
            """def test_bfl_image2_flux_pro_and_flux_dev_are_text_only():
    candidates = {
        candidate.key: candidate
        for candidate in MODEL_CATALOG[\"text_to_image\"]
    }

    assert candidates[\"flux-pro\"].supports_image_input is False
    assert candidates[\"flux-dev\"].supports_image_input is False
    assert candidates[\"gpt-image-2.5-sunburst\"].supports_image_input is True
    assert candidates[\"gemini-3.1-flash\"].supports_image_input is True


def test_gpt_image_25_gets_native_4k_dimensions_and_png():
""",
        ),
    ]

    # Build and validate every replacement before touching the worktree.
    staged: dict[str, tuple[bytes, bytes]] = {}
    for rel, file_edits in edits.items():
        staged[rel] = edit_file(root, rel, file_edits)

    print(f"Validated {len(staged)} source/test files against {head[:7]} ({branch}).")
    for rel, (old, new) in staged.items():
        digest = hashlib.sha256(new).hexdigest()[:12]
        state = "changed" if old != new else "unchanged"
        print(f"  {state:9} {rel}  sha256={digest}")

    if not args.apply:
        print("\nDry run only. Re-run with --apply to write these changes.")
        return 0

    backup_root = Path(
        tempfile.mkdtemp(prefix=f"renderstudio-image2-backup-{datetime.now():%Y%m%d-%H%M%S}-")
    )
    written: list[str] = []
    try:
        for rel, (old, new) in staged.items():
            target = root / rel
            backup = backup_root / rel
            backup.parent.mkdir(parents=True, exist_ok=True)
            backup.write_bytes(old)
            temp = target.with_name(target.name + ".image2-patch.tmp")
            temp.write_bytes(new)
            temp.replace(target)
            written.append(rel)
    except Exception:
        # Restore every file already written if any later write fails.
        for rel in written:
            (root / rel).write_bytes((backup_root / rel).read_bytes())
        raise

    print("\nApplied. Backup copies are stored outside the repository at:")
    print(f"  {backup_root}")
    print("No commit was created and no .next-dev, README, billing, video, audio, or 3D files were changed.")
    print("Next: run the verification commands listed in the accompanying instructions.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
