import os
from contextlib import contextmanager
from typing import Iterator

from psycopg import connect
from psycopg.rows import dict_row


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://campus_user:campus_pass@localhost:5432/campus_exchange",
)


@contextmanager
def get_connection() -> Iterator:
    with connect(DATABASE_URL, row_factory=dict_row) as connection:
        yield connection
