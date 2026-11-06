# EmotionVision

FastAPI + SQLAlchemy-style SQLite web application for facial-expression analysis with the exact workflow defined in the supplied project README: **Sign Up/Sign In → Home Dashboard → Upload Image or Webcam → OpenCV Face Detection → Face Crop → EfficientNet-B0 → Emotion + Confidence + Seven Probabilities + Image Information → SQLite History → Statistics**.

## UI direction
The interface uses a bright, effective visual treatment with layered gradients, colorful ambient orbs, glass panels, subtle grid texture, and vivid accent colors. It avoids a plain solid-color/white-heavy layout.

## Run on Windows
```powershell
python -m venv venv
venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
python run.py
```

Open `http://127.0.0.1:8000`.

## Model
The application exposes an EfficientNet-B0 inference interface at `ml/model.py`. Place the trained checkpoint at `ml/models/emotion_model.pth` and replace the deterministic fallback section with the trained preprocessing/inference implementation. Until then, the fallback keeps the complete authentication, upload, webcam, database and statistics workflow runnable.

## Webcam
The browser webcam frame is captured to an image and sent to the same `POST /api/analyze` endpoint as upload analysis, with the JWT in the Authorization header.
