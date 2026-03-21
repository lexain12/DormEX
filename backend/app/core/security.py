import hashlib
import secrets


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_token(length: int = 48) -> str:
    return secrets.token_urlsafe(length)


def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
