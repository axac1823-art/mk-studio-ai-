"""Tests unitaires du Video Generator.

Ces tests ne nécessitent pas de connexion aux providers réels ni à Postgres :
- détection du mode (resolve_video_mode)
- calcul des coûts (compute_video_cost)
- parsing des tags @imgN / @vidN
- concaténation ffmpeg (si ffmpeg est disponible)
"""
import sys
import uuid
from pathlib import Path

import pytest

# Le worker n'est pas installé en package : on ajoute sa racine au path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import workflows.video as video


class FakeConn:
    """Connexion factice qui retourne toujours des rows vides."""

    def execute(self, *args, **kwargs):
        class EmptyResult:
            def fetchall(self):
                return []

            def fetchone(self):
                return None

        return EmptyResult()


@pytest.fixture
def video_costs():
    return {
        "text_to_video": 25,
        "image_to_video": 30,
        "start_end_frame": 40,
        "multi_reference": 45,
        "multi_shot": 35,
        "multi_shot_concat_overhead": 5,
    }


def test_resolve_multi_shot_priority():
    job = {
        "start_image_url": "http://start",
        "end_image_url": "http://end",
        "shots": [
            {"id": str(uuid.uuid4()), "prompt": "shot 1", "taggedMediaIds": []},
            {"id": str(uuid.uuid4()), "prompt": "shot 2", "taggedMediaIds": []},
        ],
    }
    assert video.resolve_video_mode(job) == "multi_shot"


def test_resolve_start_end_frame():
    job = {
        "start_image_url": "http://start",
        "end_image_url": "http://end",
        "shots": [{"id": str(uuid.uuid4()), "prompt": "", "taggedMediaIds": []}],
    }
    assert video.resolve_video_mode(job) == "start_end_frame"


def test_resolve_multi_reference():
    job = {
        "start_image_url": None,
        "end_image_url": None,
        "media_references": [
            {"tag": "@img1", "asset_url": "http://a", "type": "image"},
            {"tag": "@img2", "asset_url": "http://b", "type": "image"},
        ],
        "shots": [{"id": str(uuid.uuid4()), "prompt": "use @img1 and @img2", "taggedMediaIds": []}],
    }
    assert video.resolve_video_mode(job) == "multi_reference"


def test_resolve_image_to_video_from_start_image():
    job = {
        "start_image_url": "http://start",
        "end_image_url": None,
        "shots": [{"id": str(uuid.uuid4()), "prompt": "", "taggedMediaIds": []}],
    }
    assert video.resolve_video_mode(job) == "image_to_video"


def test_resolve_image_to_video_from_single_tag():
    job = {
        "start_image_url": None,
        "end_image_url": None,
        "media_references": [{"tag": "@img1", "asset_url": "http://a", "type": "image"}],
        "shots": [{"id": str(uuid.uuid4()), "prompt": "ref @img1", "taggedMediaIds": []}],
    }
    assert video.resolve_video_mode(job) == "image_to_video"


def test_resolve_text_to_video():
    job = {
        "start_image_url": None,
        "end_image_url": None,
        "media_references": [],
        "shots": [{"id": str(uuid.uuid4()), "prompt": "a cinematic flyover", "taggedMediaIds": []}],
    }
    assert video.resolve_video_mode(job) == "text_to_video"


def test_resolve_video_to_video_from_vid_tag():
    job = {
        "start_image_url": None,
        "end_image_url": None,
        "media_references": [{"tag": "@vid1", "asset_url": "http://video", "type": "video"}],
        "shots": [{"id": str(uuid.uuid4()), "prompt": "make it rain @vid1", "taggedMediaIds": []}],
    }
    assert video.resolve_video_mode(job) == "video_to_video"


def test_resolve_relight_hint():
    job = {
        "mode": "relight",
        "start_image_url": None,
        "end_image_url": None,
        "media_references": [{"tag": "@vid1", "asset_url": "http://video", "type": "video"}],
        "shots": [{"id": str(uuid.uuid4()), "prompt": "golden hour @vid1", "taggedMediaIds": []}],
    }
    assert video.resolve_video_mode(job) == "relight"


def test_compute_video_cost_single_mode(monkeypatch, video_costs):
    monkeypatch.setattr(video, "_get_action_costs", lambda _conn: video_costs)
    assert video.compute_video_cost(FakeConn(), "start_end_frame", 1) == 40


def test_compute_video_cost_multi_shot(monkeypatch, video_costs):
    monkeypatch.setattr(video, "_get_action_costs", lambda _conn: video_costs)
    assert video.compute_video_cost(FakeConn(), "multi_shot", 3) == 35 * 3 + 5


def test_strip_tags_and_tagged_media_urls():
    refs = [
        {"tag": "@img1", "asset_url": "http://img1", "type": "image"},
        {"tag": "@vid1", "asset_url": "http://vid1", "type": "video"},
    ]
    prompt = "start with @img1 then @vid1 and @img1 again"
    assert video._count_tagged_media(prompt) == 2
    assert video._strip_tags(prompt) == "start with  then  and  again"
    assert video._tagged_media_urls(prompt, refs) == ["http://img1", "http://vid1"]


def test_concatenate_single_clip(tmp_path):
    """Un seul clip ne nécessite pas de concaténation."""
    path = "/storage/only.mp4"
    assert video._concatenate_video_clips([path]) == path


@pytest.mark.skipif(
    __import__("shutil").which("ffmpeg") is None,
    reason="ffmpeg not installed",
)
def test_concatenate_multiple_clips(tmp_path):
    """Génère deux clips factices avec ffmpeg et vérifie la concaténation."""
    import shutil

    clips = []
    for i in range(2):
        out = tmp_path / f"clip{i}.mp4"
        subprocess_run = shutil.which("ffmpeg")
        assert subprocess_run
        import subprocess

        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-f",
                "lavfi",
                "-i",
                "testsrc=duration=1:size=320x240:rate=1",
                "-pix_fmt",
                "yuv420p",
                str(out),
            ],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        clips.append(str(out))

    # On simule des chemins /storage/ en copiant les fichiers générés.
    import storage as storage_mod

    storage_mod.STORAGE_DIR = tmp_path / "storage"
    storage_mod.STORAGE_DIR.mkdir(exist_ok=True)
    storage_paths = []
    for clip in clips:
        data = Path(clip).read_bytes()
        path = storage_mod.save_file(data, "mp4")
        storage_paths.append(path)

    final = video._concatenate_video_clips(storage_paths)
    assert final.startswith("/storage/")
    assert (storage_mod.STORAGE_DIR / final.removeprefix("/storage/")).exists()
