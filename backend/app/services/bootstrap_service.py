from ..repositories.platform_repository import PlatformRepository


class BootstrapService:
    def __init__(self, repository: PlatformRepository | None = None) -> None:
        self.repository = repository or PlatformRepository()

    def ensure_bootstrap_data(self) -> None:
        self.repository.ensure_seed_data()
