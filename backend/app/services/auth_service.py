from fastapi import Request

from ..core.exceptions import DomainValidationError
from ..core.security import generate_otp_code, hash_token
from ..repositories.auth_repository import AuthRepository
from ..repositories.user_repository import UserRepository


class AuthService:
    def __init__(
        self,
        auth_repository: AuthRepository | None = None,
        user_repository: UserRepository | None = None,
    ) -> None:
        self.auth_repository = auth_repository or AuthRepository()
        self.user_repository = user_repository or UserRepository()

    def request_code(self, email: str) -> dict:
        domain = email.split("@")[-1].lower()
        university = self.auth_repository.get_university_by_email_domain(domain)
        if university is None:
            raise DomainValidationError("Email domain is not allowed")

        code = generate_otp_code()
        self.auth_repository.save_email_verification_code(
            email=email,
            code_hash=hash_token(code),
            university_id=university["id"],
            expires_in_sec=600,
        )

        return {
            "status": "code_sent",
            "expires_in_sec": 600,
        }

    def verify_code(self, *, email: str, code: str, request: Request) -> dict:
        verification = self.auth_repository.get_active_email_verification_code(email)
        if verification is None:
            raise DomainValidationError("Verification code is missing or expired")
        if verification["code_hash"] != hash_token(code):
            raise DomainValidationError("Invalid verification code")

        self.auth_repository.mark_email_verification_code_used(str(verification["id"]))

        user = self.user_repository.get_user_by_email(email)
        if user is None:
            local_part = email.split("@", 1)[0].replace(".", " ").replace("_", " ").title()
            user_context = self.user_repository.create_user(
                email=email,
                university_id=verification["university_id"],
                full_name=local_part or "New User",
            )
            user = self.user_repository.get_user_by_email(email)
            if user is None:
                raise RuntimeError("Failed to load created user")
        else:
            self.user_repository.mark_email_verified(user_id=user["id"])

        tokens = self.auth_repository.create_session(
            user_id=user["id"],
            user_agent=request.headers.get("User-Agent"),
            ip=request.client.host if request.client is not None else None,
        )

        return {
            **tokens,
            "user": self._serialize_authenticated_user(user),
        }

    def refresh(self, refresh_token: str) -> dict:
        session = self.auth_repository.get_session_by_refresh_token(refresh_token)
        if session is None:
            raise DomainValidationError("Invalid refresh token")

        user = self.user_repository.get_user_context(session["user_id"])
        if user is None:
            raise DomainValidationError("User not found")

        tokens = self.auth_repository.rotate_refresh_token(session_id=str(session["id"]))
        user_profile = self.user_repository.get_me_profile(user["id"])
        if user_profile is None:
            raise DomainValidationError("User not found")

        return {
            **tokens,
            "user": {
                "id": user_profile["id"],
                "email": user["email"],
                "full_name": user_profile["full_name"],
                "role": user["role"],
                "university": {
                    "id": user_profile["university_id"],
                    "name": user_profile["university_name"],
                },
                "dormitory": (
                    {
                        "id": user_profile["dormitory_id"],
                        "name": user_profile["dormitory_name"],
                    }
                    if user_profile["dormitory_id"] is not None
                    else None
                ),
                "profile_completed": bool(user_profile["full_name"] and user_profile["dormitory_id"]),
            },
        }

    def logout(self, access_token: str) -> dict:
        self.auth_repository.revoke_session(session_id=access_token)
        return {"status": "logged_out"}

    def _serialize_authenticated_user(self, user: dict) -> dict:
        return {
            "id": user["id"],
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "university": {
                "id": user["university_id"],
                "name": user["university_name"],
            },
            "dormitory": (
                {
                    "id": user["dormitory_id"],
                    "name": user["dormitory_name"],
                }
                if user["dormitory_id"] is not None
                else None
            ),
            "profile_completed": bool(user["full_name"] and user["dormitory_id"]),
        }
