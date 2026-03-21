from pydantic import BaseModel


class EmailRequestCodeRequest(BaseModel):
    email: str


class EmailRequestCodeResponse(BaseModel):
    status: str
    expires_in_sec: int


class EmailVerifyCodeRequest(BaseModel):
    email: str
    code: str


class AuthRefreshRequest(BaseModel):
    refresh_token: str


class AuthTokenUserUniversityResponse(BaseModel):
    id: int
    name: str


class AuthTokenUserDormitoryResponse(BaseModel):
    id: int
    name: str


class AuthenticatedUserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    university: AuthTokenUserUniversityResponse
    dormitory: AuthTokenUserDormitoryResponse | None = None
    profile_completed: bool


class AuthTokensResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: AuthenticatedUserResponse


class LogoutResponse(BaseModel):
    status: str
