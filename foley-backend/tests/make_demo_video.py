import cv2
import numpy as np
from pathlib import Path


def create_demo_video(output_path: str = "demo_test.mp4") -> list:
    """
    Creates a 6-second, 30 fps, 640x360 synthetic video of a bouncing ball
    with known impact frames at 30, 78, and 126.
    Includes a 2-frame flash and floor impact for deterministic motion detection.
    """
    fps = 30
    duration_s = 6
    n_frames = fps * duration_s  # 180 frames
    width = 640
    height = 360
    floor_y = 300
    ball_radius = 18

    impact_frames = [30, 78, 126]
    
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    # Pre-calculate ball trajectory
    # Arc 1: 0 to 30
    # Arc 2: 30 to 78
    # Arc 3: 78 to 126
    # Arc 4: 126 to 180 (settling)
    ball_positions = []
    for f in range(n_frames):
        if f <= 30:
            t = f / 30.0
            y = int(50 + (floor_y - 50) * (t ** 2))
            x = int(120 + 80 * t)
        elif f <= 78:
            t = (f - 30) / 48.0
            # Parabola peaking at y=120
            y = int(floor_y - 4 * (floor_y - 120) * t * (1 - t))
            x = int(200 + 120 * t)
        elif f <= 126:
            t = (f - 78) / 48.0
            # Lower bounce peaking at y=190
            y = int(floor_y - 4 * (floor_y - 190) * t * (1 - t))
            x = int(320 + 120 * t)
        else:
            t = min(1.0, (f - 126) / 30.0)
            y = int(floor_y - 4 * (floor_y - 250) * t * (1 - t)) if t < 1.0 else floor_y
            x = int(440 + 80 * t)
        ball_positions.append((x, y))

    for f in range(n_frames):
        # Dark slate background
        frame = np.full((height, width, 3), 25, dtype=np.uint8)

        # Draw floor line
        cv2.line(frame, (0, floor_y + ball_radius), (width, floor_y + ball_radius), (80, 80, 90), 2)

        # 2-frame impact flash at known frames
        is_flash = any(imp <= f <= imp + 1 for imp in impact_frames)
        if is_flash:
            # Add strong brightness flash at floor collision point
            cv2.circle(frame, (ball_positions[f][0], floor_y + ball_radius), 50, (255, 255, 255), -1)

        # Draw white ball
        bx, by = ball_positions[f]
        cv2.circle(frame, (bx, by), ball_radius, (240, 240, 245), -1)
        cv2.circle(frame, (bx, by), ball_radius, (160, 160, 170), 2)

        out.write(frame)

    out.release()
    return impact_frames


if __name__ == "__main__":
    frames = create_demo_video("demo_test.mp4")
    print(f"Created demo_test.mp4 with impact frames at: {frames}")