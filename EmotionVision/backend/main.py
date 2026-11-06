from pathlib import Path
from datetime import datetime, timedelta, timezone
import base64, io, os, hashlib, hmac

from fastapi import FastAPI, Request, UploadFile, File, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from jose import jwt, JWTError
from PIL import Image

from ml.model import predict_emotion
from .db import get_db, init_db

BASE = Path(__file__).resolve().parent.parent
SECRET_KEY = os.getenv('EMOTIONVISION_SECRET', 'emotionvision-demo-secret-change-me')
ALGORITHM = 'HS256'
UPLOADS = BASE / 'uploads'
UPLOADS.mkdir(exist_ok=True)

app = FastAPI(title='EmotionVision', version='1.0.0')
app.mount('/static', StaticFiles(directory=str(BASE / 'static')), name='static')
templates = Jinja2Templates(directory=str(BASE / 'templates'))

@app.on_event('startup')
def startup():
    init_db()

def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 120000)
    return base64.b64encode(salt + digest).decode()

def verify_password(password: str, stored: str) -> bool:
    try:
        raw = base64.b64decode(stored.encode())
        salt, expected = raw[:16], raw[16:]
        actual = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 120000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False

def make_token(user_id: int, username: str):
    return jwt.encode({'sub': str(user_id), 'username': username, 'exp': datetime.now(timezone.utc) + timedelta(hours=12)}, SECRET_KEY, algorithm=ALGORITHM)

def current_user(request: Request):
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        raise HTTPException(status_code=401, detail='Authentication required')
    try:
        payload = jwt.decode(auth.split(' ', 1)[1], SECRET_KEY, algorithms=[ALGORITHM])
        return {'id': int(payload['sub']), 'username': payload['username']}
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail='Invalid or expired token')

@app.get('/', response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse('index.html', {'request': request})

@app.post('/api/signup')
async def signup(payload: dict):
    username = str(payload.get('username', '')).strip()
    password = str(payload.get('password', ''))
    if len(username) < 3 or len(password) < 6:
        raise HTTPException(400, 'Username must be 3+ characters and password 6+ characters.')
    with get_db() as db:
        if db.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone():
            raise HTTPException(409, 'Username already exists.')
        cur = db.execute('INSERT INTO users(username,password_hash) VALUES(?,?)', (username, hash_password(password)))
        db.commit()
        user_id = cur.lastrowid
    return {'token': make_token(user_id, username), 'username': username}

@app.post('/api/signin')
async def signin(payload: dict):
    username = str(payload.get('username', '')).strip()
    password = str(payload.get('password', ''))
    with get_db() as db:
        row = db.execute('SELECT id, username, password_hash FROM users WHERE username=?', (username,)).fetchone()
    if not row or not verify_password(password, row['password_hash']):
        raise HTTPException(401, 'Invalid username or password.')
    return {'token': make_token(row['id'], row['username']), 'username': row['username']}

async def image_bytes_from_request(upload: UploadFile | None, payload: dict | None):
    if upload is not None:
        data = await upload.read()
        filename = upload.filename or 'uploaded-image.jpg'
        return data, filename
    if payload and payload.get('image'):
        value = payload['image']
        if ',' in value: value = value.split(',', 1)[1]
        return base64.b64decode(value), 'webcam-capture.jpg'
    raise HTTPException(400, 'No image supplied.')

@app.post('/api/analyze')
async def analyze(request: Request, file: UploadFile | None = File(default=None), user=Depends(current_user)):
    payload = None
    if file is None:
        try: payload = await request.json()
        except Exception: payload = None
    data, filename = await image_bytes_from_request(file, payload)
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(413, 'Image is too large. Maximum 10 MB.')
    try:
        image = Image.open(io.BytesIO(data)).convert('RGB')
    except Exception:
        raise HTTPException(400, 'Please provide a valid image.')
    result = predict_emotion(image)
    result['filename'] = filename
    result['user_id'] = user['id']
    with get_db() as db:
        db.execute('INSERT INTO results(user_id,emotion,confidence,created_at) VALUES(?,?,?,?)',
                   (user['id'], result['emotion'], f"{result['confidence']:.1f}%", datetime.now()))
        db.commit()
    return result

@app.get('/api/history')
def history(user=Depends(current_user)):
    with get_db() as db:
        rows = db.execute('SELECT id, emotion, confidence, created_at FROM results WHERE user_id=? ORDER BY id DESC LIMIT 50', (user['id'],)).fetchall()
    return [dict(r) for r in rows]

@app.get('/api/statistics')
def statistics(user=Depends(current_user)):
    with get_db() as db:
        rows = db.execute('SELECT emotion, COUNT(*) AS count FROM results WHERE user_id=? GROUP BY emotion', (user['id'],)).fetchall()
    counts = {r['emotion']: r['count'] for r in rows}
    emotions = ['happy','sad','angry','surprise','fear','disgust','neutral']
    return {'labels': emotions, 'values': [counts.get(e,0) for e in emotions], 'total': sum(counts.values())}

@app.get('/health')
def health():
    return {'status':'ok', 'model':'EfficientNet-B0 interface'}
