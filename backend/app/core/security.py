import hashlib
import hmac
import secrets


def generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_token(length: int = 48) -> str:
    return secrets.token_urlsafe(length)


def hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return f"{salt}:{digest}"


def verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash or ":" not in password_hash:
        return False

    salt, expected_digest = password_hash.split(":", 1)
    actual_digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return hmac.compare_digest(actual_digest, expected_digest)
