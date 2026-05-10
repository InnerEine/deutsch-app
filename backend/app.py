from datetime import date, datetime, timedelta
import json
import os
from urllib import error, request as urllib_request

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    get_jwt_identity,
    jwt_required,
)
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import check_password_hash, generate_password_hash


app = Flask(__name__)
cors_origins = os.getenv("CORS_ORIGINS", "*")
CORS(
    app,
    resources={
        r"/api/*": {
            "origins": (
                [origin.strip() for origin in cors_origins.split(",")]
                if cors_origins != "*"
                else "*"
            )
        }
    },
)

app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
    "DATABASE_URL", "sqlite:///deutsch_app.db"
)
app.config["JWT_SECRET_KEY"] = os.getenv(
    "JWT_SECRET_KEY", "deutsch-dev-secret-key-please-change-123456"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["OLLAMA_BASE_URL"] = os.getenv(
    "OLLAMA_BASE_URL", "http://127.0.0.1:11434"
)
app.config["OLLAMA_MODEL"] = os.getenv("OLLAMA_MODEL", "gemma3")
app.config["OLLAMA_KEEP_ALIVE"] = os.getenv("OLLAMA_KEEP_ALIVE", "10m")
app.config["OLLAMA_TIMEOUT"] = int(os.getenv("OLLAMA_TIMEOUT", "120"))
app.config["AI_PROVIDER"] = os.getenv("AI_PROVIDER", "ollama")
app.config["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")
app.config["GEMINI_MODEL"] = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
app.config["GEMINI_TIMEOUT"] = int(os.getenv("GEMINI_TIMEOUT", "120"))

ALLOWED_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}


def http_post_json(url, payload, headers=None, timeout=60):
    req = urllib_request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urllib_request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))

db = SQLAlchemy(app)
jwt = JWTManager(app)


class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    level = db.Column(db.String(10), default="A1")
    points = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Progress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    lesson_id = db.Column(db.String(50), nullable=False)
    completed = db.Column(db.Boolean, default=False)
    score = db.Column(db.Integer, default=0)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "lesson_id", name="uq_progress_user_lesson"),
    )


class VocabProgress(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    word = db.Column(db.String(100), nullable=False)
    level = db.Column(db.Integer, default=0)
    next_review = db.Column(db.Date, nullable=False)
    last_reviewed = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("user_id", "word", name="uq_vocab_user_word"),
    )


class Analytics(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    data = db.Column(db.JSON, nullable=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


def json_body():
    return request.get_json(silent=True) or {}


def build_auth_payload(user):
    access_token = create_access_token(
        identity=str(user.id), expires_delta=timedelta(days=14)
    )
    return {
        "token": access_token,
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "level": user.level,
            "points": user.points,
        },
    }


def get_current_user():
    user_id = get_jwt_identity()
    return User.query.get(int(user_id)) if user_id is not None else None


def ollama_request(system_prompt, messages, max_tokens=400):
    base_url = app.config["OLLAMA_BASE_URL"].rstrip("/")
    model = app.config["OLLAMA_MODEL"]
    keep_alive = app.config["OLLAMA_KEEP_ALIVE"]
    timeout = app.config["OLLAMA_TIMEOUT"]
    payload_messages = [{"role": "system", "content": system_prompt}]
    payload_messages.extend(messages)
    try:
        data = http_post_json(
            f"{base_url}/api/chat",
            {
                "model": model,
                "messages": payload_messages,
                "stream": False,
                "keep_alive": keep_alive,
                "options": {"num_predict": max_tokens},
            },
            timeout=timeout,
        )
        text = (data.get("message") or {}).get("content", "").strip()
        if not text:
            return None, "Ollama returned an empty response."
        return text, None
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        return None, f"Ollama HTTP {exc.code}: {details}"
    except error.URLError:
        return (
            None,
            "Ollama is not reachable. Install Ollama, start it, and run a model like `ollama run gemma3`.",
        )
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def gemini_request(system_prompt, messages, max_tokens=400, generation_config=None):
    api_key = app.config["GEMINI_API_KEY"]
    if not api_key:
        return None, "GEMINI_API_KEY is not configured."

    model = app.config["GEMINI_MODEL"]
    timeout = app.config["GEMINI_TIMEOUT"]
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent"
    )
    contents = [
        {
            "role": "model" if item["role"] == "assistant" else "user",
            "parts": [{"text": item["content"]}],
        }
        for item in messages
        if item.get("content")
    ]
    gen_cfg = {"temperature": 0.7, "maxOutputTokens": max_tokens}
    if isinstance(generation_config, dict):
        gen_cfg.update(generation_config)
    payload = {
        "contents": contents,
        "generationConfig": gen_cfg,
    }
    if system_prompt:
        payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}
    try:
        data = http_post_json(
            url,
            payload,
            headers={"x-goog-api-key": api_key},
            timeout=timeout,
        )
        parts = (
            ((data.get("candidates") or [{}])[0].get("content") or {}).get("parts")
            or []
        )
        text = "\n".join(part.get("text", "") for part in parts).strip()
        if not text:
            return None, "Gemini returned an empty response."
        return text, None
    except error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        return None, f"Gemini HTTP {exc.code}: {details}"
    except error.URLError:
        return None, "Gemini is not reachable. Check network access and API key restrictions."
    except Exception as exc:  # noqa: BLE001
        return None, str(exc)


def ai_request(system_prompt, messages, max_tokens=400, generation_config=None):
    provider = app.config["AI_PROVIDER"]
    if provider == "ollama":
        return ollama_request(system_prompt, messages, max_tokens=max_tokens)
    if provider == "gemini":
        return gemini_request(
            system_prompt,
            messages,
            max_tokens=max_tokens,
            generation_config=generation_config,
        )
    return None, f"Unsupported AI_PROVIDER: {provider}"


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify(
        {
            "status": "ok",
            "ai_provider": app.config["AI_PROVIDER"],
            "ollama_model": app.config["OLLAMA_MODEL"],
            "gemini_model": app.config["GEMINI_MODEL"],
            "gemini_configured": bool(app.config["GEMINI_API_KEY"]),
        }
    )


@app.route("/api/register", methods=["POST"])
def register():
    data = json_body()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    username = (data.get("username") or email.split("@")[0] or "").strip()

    if not email or not password or not username:
        return jsonify({"error": "username, email and password are required"}), 400
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        return jsonify({"error": "Valid email is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already exists"}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already exists"}), 400

    user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
    )
    db.session.add(user)
    db.session.commit()
    return jsonify(build_auth_payload(user))


@app.route("/api/login", methods=["POST"])
def login():
    data = json_body()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid credentials"}), 401
    return jsonify(build_auth_payload(user))


@app.route("/api/profile", methods=["GET", "PUT", "PATCH"])
@jwt_required()
def profile():
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if request.method in {"PUT", "PATCH"}:
        data = json_body()
        username = (data.get("username") or "").strip()
        level = (data.get("level") or "").strip()
        points = data.get("points")

        if username and username != user.username:
            exists = User.query.filter(
                User.username == username, User.id != user.id
            ).first()
            if exists:
                return jsonify({"error": "Username already exists"}), 400
            user.username = username
        if level and level not in ALLOWED_LEVELS:
            return jsonify({"error": "Invalid level"}), 400
        if level:
            user.level = level
        if isinstance(points, int) and points >= 0:
            user.points = points
        db.session.commit()

    return jsonify(
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "level": user.level,
            "points": user.points,
        }
    )


@app.route("/api/progress", methods=["GET", "POST"])
@jwt_required()
def progress():
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if request.method == "POST":
        data = json_body()
        lesson_id = data.get("lesson_id")
        if not lesson_id:
            return jsonify({"error": "lesson_id is required"}), 400

        progress_item = Progress.query.filter_by(
            user_id=user.id, lesson_id=lesson_id
        ).first()
        if not progress_item:
            progress_item = Progress(user_id=user.id, lesson_id=lesson_id)
            db.session.add(progress_item)

        try:
            score = int(data.get("score", 0) or 0)
        except (TypeError, ValueError):
            return jsonify({"error": "score must be a number"}), 400

        progress_item.completed = bool(data.get("completed", False))
        progress_item.score = max(0, score)
        progress_item.completed_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Progress saved"})

    progress_items = Progress.query.filter_by(user_id=user.id).all()
    return jsonify(
        [
            {
                "lesson_id": item.lesson_id,
                "completed": item.completed,
                "score": item.score,
            }
            for item in progress_items
        ]
    )


@app.route("/api/vocab_progress", methods=["GET", "POST"])
@jwt_required()
def vocab_progress():
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    if request.method == "POST":
        data = json_body()
        word = data.get("word")
        next_review = data.get("next_review")
        if not word or not next_review:
            return jsonify({"error": "word and next_review are required"}), 400

        vocab_item = VocabProgress.query.filter_by(user_id=user.id, word=word).first()
        if not vocab_item:
            vocab_item = VocabProgress(
                user_id=user.id,
                word=word,
                level=0,
                next_review=date.today(),
            )
            db.session.add(vocab_item)

        try:
            level = int(data.get("level", 0) or 0)
            next_review_date = datetime.fromisoformat(next_review).date()
        except (TypeError, ValueError):
            return jsonify({"error": "level or next_review is invalid"}), 400

        vocab_item.level = max(0, min(level, 5))
        vocab_item.next_review = next_review_date
        vocab_item.last_reviewed = datetime.utcnow()
        db.session.commit()
        return jsonify({"message": "Vocab progress saved"})

    vocab_items = VocabProgress.query.filter_by(user_id=user.id).all()
    return jsonify(
        [
            {
                "word": item.word,
                "level": item.level,
                "next_review": item.next_review.isoformat(),
            }
            for item in vocab_items
        ]
    )


@app.route("/api/analytics", methods=["POST"])
@jwt_required()
def analytics():
    user = get_current_user()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = json_body()
    action = (data.get("action") or "").strip()
    if not action:
        return jsonify({"error": "action is required"}), 400

    anal = Analytics(user_id=user.id, action=action, data=data.get("data"))
    db.session.add(anal)
    db.session.commit()
    return jsonify({"message": "Analytics logged"})


@app.route("/api/push_subscribe", methods=["POST"])
@jwt_required()
def push_subscribe():
    return jsonify({"message": "Push subscription saved"})


@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    data = json_body()
    system_prompt = data.get("system") or ""
    user_message = data.get("message") or ""
    history = data.get("history") or []
    try:
        max_tokens = int(data.get("max_tokens", 400) or 400)
    except (TypeError, ValueError):
        return jsonify({"error": "max_tokens must be a number"}), 400
    max_tokens = max(50, min(max_tokens, 1000))

    if not system_prompt or not user_message:
        return jsonify({"error": "system and message are required"}), 400

    messages = []
    for item in history[-10:]:
        role = item.get("role")
        content = item.get("content")
        if role in {"user", "assistant"} and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    text, err = ai_request(system_prompt, messages, max_tokens=max_tokens)
    if err:
        return jsonify({"error": err}), 503
    return jsonify({"text": text})


@app.route("/api/ai/generate", methods=["POST"])
def ai_generate():
    """Generic prompt -> text endpoint for the frontend.

    Body:
      {
        "prompt": "...",
        "system": "..." (optional),
        "generationConfig": { "temperature": 0.7, "maxOutputTokens": 1000 } (optional)
      }
    """
    data = json_body()
    prompt = data.get("prompt") or ""
    system_prompt = data.get("system") or ""
    generation_config = data.get("generationConfig") or {}

    if not prompt:
        return jsonify({"error": "prompt is required"}), 400
    if not isinstance(generation_config, dict):
        return jsonify({"error": "generationConfig must be an object"}), 400

    try:
        max_tokens = int(generation_config.get("maxOutputTokens", 1000) or 1000)
    except (TypeError, ValueError):
        return jsonify({"error": "maxOutputTokens must be a number"}), 400
    max_tokens = max(50, min(max_tokens, 8192))
    generation_config["maxOutputTokens"] = max_tokens

    text, err = ai_request(
        system_prompt,
        [{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        generation_config=generation_config,
    )
    if err:
        return jsonify({"error": err}), 503
    return jsonify({"text": text})


@app.route("/api/ai/homework-feedback", methods=["POST"])
def ai_homework_feedback():
    data = json_body()
    answer = data.get("answer") or ""
    homework = data.get("homework") or {}
    level = data.get("level") or "A1"

    if not answer or not homework.get("desc"):
        return jsonify({"error": "answer and homework.desc are required"}), 400

    prompt = (
        f'Du bist ein Deutschlehrer. Analysiere diese Hausaufgabe des Lernenden '
        f'(Niveau: {level}).\n'
        f'Aufgabe: "{homework["desc"]}"\n'
        f'Antwort des Lernenden: "{answer}"\n'
        "Gib Feedback auf Russisch im Format:\n"
        "Что хорошо: [...]\n"
        "Ошибки: [если есть: неправильно -> правильно]\n"
        "Совет: [короткий совет]\n"
        "Оценка: [1-10]"
    )
    text, err = ai_request(
        "Du bist ein hilfsbereiter Deutschlehrer. Antworte auf Russisch.",
        [{"role": "user", "content": prompt}],
        max_tokens=350,
    )
    if err:
        return jsonify({"error": err}), 503
    return jsonify({"text": text})


def ensure_database():
    with app.app_context():
        db.create_all()


ensure_database()


if __name__ == "__main__":
    app.run(
        host=os.getenv("FLASK_HOST", "127.0.0.1"),
        port=int(os.getenv("FLASK_PORT", "5000")),
        debug=os.getenv("FLASK_DEBUG", "0") == "1",
    )
