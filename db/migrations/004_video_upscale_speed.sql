-- Fixed cost for video playback speed processing with MoviePy.
INSERT INTO action_costs (feature_type, credit_cost)
VALUES ('video_upscale_speed', 20)
ON CONFLICT (feature_type) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;
