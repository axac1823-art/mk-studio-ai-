-- Image-to-video est offert aux utilisateurs dans l'application.
UPDATE video_action_costs
SET credit_cost = 0
WHERE mode = 'image_to_video';

INSERT INTO video_action_costs (mode, credit_cost)
VALUES ('image_to_video', 0)
ON CONFLICT (mode) DO UPDATE SET credit_cost = 0;
