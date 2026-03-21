import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Any

from .exceptions import AuthenticationError


ACCESS_TOKEN_SECRET = os.getenv("ACCESS_TOKEN_SECRET", "dev-access-token-secret")
ACCESS_TOKEN_TTL_SEC = int(os.getenv("ACCESS_TOKEN_TTL_SEC", "3600"))


def _encode_segment(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _decode_segment(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(f"{data}{padding}")


def _sign_segment(segment: str) -> str:
    return hmac.new(
        ACCESS_TOKEN_SECRET.encode("utf-8"),
        segment.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def create_access_token(user_id: int) -> str:
    payload = {
        "sub": user_id,
        "exp": int(time.time()) + ACCESS_TOKEN_TTL_SEC,
    }
    encoded_payload = _encode_segment(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = _sign_segment(encoded_payload)
    return f"ceh.{encoded_payload}.{signature}"


def decode_access_token(token: str) -> int:
    try:
        prefix, encoded_payload, signature = token.split(".", 2)
    except ValueError as error:
        raise AuthenticationError("Invalid access token") from error

    if prefix != "ceh":
        raise AuthenticationError("Invalid access token")

    expected_signature = _sign_segment(encoded_payload)
    if not hmac.compare_digest(signature, expected_signature):
        raise AuthenticationError("Invalid access token")

    try:
        payload = json.loads(_decode_segment(encoded_payload).decode("utf-8"))
    except (ValueError, json.JSONDecodeError) as error:
        raise AuthenticationError("Invalid access token") from error

    if int(payload.get("exp", 0)) <= int(time.time()):
        raise AuthenticationError("Access token expired")

    user_id = payload.get("sub")
    if not isinstance(user_id, int):
        raise AuthenticationError("Invalid access token")

    return user_id


def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_verification_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    return token.strip()
