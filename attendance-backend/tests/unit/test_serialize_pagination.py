from datetime import UTC, date, datetime

from bson import ObjectId

from app.utils.pagination import Page, page_meta
from app.utils.serialize import doc_out, jsonable


def test_jsonable_converts_nested_types():
    oid = ObjectId()
    out = jsonable({
        "id": oid,
        "at": datetime(2026, 10, 9, 12, 56, 56, tzinfo=UTC),
        "d": date(2026, 10, 9),
        "list": [oid, {"x": oid}],
    })
    assert out["id"] == str(oid)
    assert out["at"] == "2026-10-09T12:56:56Z"
    assert out["d"] == "2026-10-09"
    assert out["list"] == [str(oid), {"x": str(oid)}]


def test_doc_out_renames_id_and_drops_private_fields():
    oid = ObjectId()
    out = doc_out({"_id": oid, "password_hash": "x", "name": "a"}, drop=("password_hash", "missing"))
    assert out == {"id": str(oid), "name": "a"}


def test_doc_out_none():
    assert doc_out(None) is None


def test_page_skip_and_meta():
    p = Page(page=3, page_size=20)
    assert p.skip == 40
    assert page_meta(p, 95) == {"page": 3, "page_size": 20, "total": 95}
