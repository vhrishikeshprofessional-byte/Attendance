from __future__ import annotations

from fastapi import Query


class Page:
    def __init__(self, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200)):
        self.page, self.page_size = page, page_size

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size


def page_meta(p: Page, total: int) -> dict:
    return {"page": p.page, "page_size": p.page_size, "total": total}
