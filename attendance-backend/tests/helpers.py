API = "/api/v1"


def ist(day: str, hm: str) -> str:
    """ISO timestamp in IST, e.g. ist('2025-01-06', '09:00')."""
    return f"{day}T{hm}:00+05:30"
