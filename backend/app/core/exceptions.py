class DomainValidationError(Exception):
    pass


class AuthenticationError(Exception):
    pass


class ForbiddenError(Exception):
    pass


class TooManyRequestsError(Exception):
    pass


class ExternalServiceError(Exception):
    pass
