import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from prompts import (
    IMAGE2_SEASON_PROMPTS,
    IMAGE2_WEATHER_PROMPTS,
    build_feature_prompt,
    build_text_to_image_prompt,
    build_weather_season_prompt,
)


def test_no_weather_or_season_adds_no_environment_prompt():
    assert build_weather_season_prompt() == ""
    prompt = build_text_to_image_prompt(
        scene_details="A modern residential building."
    )
    assert "SELECTED WEATHER CONDITION" not in prompt
    assert "SELECTED SEASON" not in prompt


def test_all_weather_options_have_prompts():
    expected = {
        "clear_sunny", "partly_cloudy", "overcast", "dark_clouds",
        "thunderstorm", "rain", "fog_mist", "snow", "dust_haze",
    }
    assert expected <= IMAGE2_WEATHER_PROMPTS.keys()
    for weather_id in expected:
        assert IMAGE2_WEATHER_PROMPTS[weather_id]
        assert "SELECTED WEATHER CONDITION" in build_weather_season_prompt(weather=weather_id)


def test_all_season_options_have_prompts():
    expected = {"spring", "summer", "autumn", "winter"}
    assert expected <= IMAGE2_SEASON_PROMPTS.keys()
    for season_id in expected:
        assert IMAGE2_SEASON_PROMPTS[season_id]
        assert "SELECTED SEASON" in build_weather_season_prompt(season=season_id)


def test_weather_and_season_are_independent_and_combined():
    prompt = build_weather_season_prompt(weather="rain", season="autumn")
    assert "SELECTED WEATHER CONDITION" in prompt
    assert "SELECTED SEASON" in prompt
    assert "Keep the building's architectural identity" in prompt


def test_unknown_values_add_no_environment_prompt():
    assert build_weather_season_prompt(weather="unknown", season="unknown") == ""


def test_text_to_image_and_feature_dispatch_include_environment_prompt():
    prompt = build_text_to_image_prompt(
        scene_details="A modern residential building.", weather="snow", season="winter"
    )
    assert "SELECTED WEATHER CONDITION" in prompt
    assert "SELECTED SEASON" in prompt

    dispatched = build_feature_prompt(
        "text_to_image",
        {"sceneDetails": "A modern residential building.", "weather": "rain", "season": "summer"},
    )
    assert "SELECTED WEATHER CONDITION" in dispatched
    assert "SELECTED SEASON" in dispatched
