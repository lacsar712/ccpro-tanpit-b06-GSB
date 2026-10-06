from ninja import NinjaAPI, Schema
from ninja.errors import HttpError

from pits.auth import BearerAuth, make_token
from pits.models import Pit, User, VisibilitySetting, Yard
from pits.rules import (
    RuleError,
    assert_can_set_status,
    get_visibility,
    latest_ph,
    save_visibility,
    visibility_flags,
)

api = NinjaAPI(title="TanPit", urls_namespace="tanpit")
auth = BearerAuth()


class LoginIn(Schema):
    username: str
    password: str


class SampleIn(Schema):
    ph: float


class StatusIn(Schema):
    status: str


class VisibilityIn(Schema):
    fill: bool
    tanning: bool
    drained: bool


def pit_json(pit: Pit) -> dict:
    return {
        "id": pit.id,
        "code": pit.code,
        "status": pit.status,
        "row": pit.row,
        "col": pit.col,
        "latestPh": latest_ph(pit),
        "sampleCount": pit.samples.count(),
    }


def visibility_json(obj: VisibilitySetting) -> dict:
    return {"fill": obj.show_fill, "tanning": obj.show_tanning, "drained": obj.show_drained}


@api.post("/auth/login")
def login(request, payload: LoginIn):
    user = User.objects.filter(username=payload.username).first()
    if user is None or not user.check_password(payload.password):
        raise HttpError(401, "用户名或密码错误")
    return {"access_token": make_token(user.username), "user": {"username": user.username, "role": user.role}}


@api.get("/auth/me", auth=auth)
def me(request):
    user = request.auth
    return {"username": user.username, "role": user.role}


@api.get("/health")
def health(request):
    return {"status": "ok", "service": "TanPit"}


@api.get("/board", auth=auth)
def board(request):
    yard = Yard.objects.prefetch_related("pits__samples").first()
    if yard is None:
        raise HttpError(404, "尚无鞣场")
    pits = sorted(yard.pits.all(), key=lambda p: (p.row, p.col))
    return {
        "yard": yard.name,
        "village": yard.village,
        "visibility": visibility_flags(),
        "pits": [pit_json(p) for p in pits],
    }


@api.get("/ledger", auth=auth)
def ledger(request):
    """酸碱台账：只列开关打开的坑态；三路全关则返回空表，不塞假行。"""
    yard = Yard.objects.prefetch_related("pits__samples").first()
    if yard is None:
        raise HttpError(404, "尚无鞣场")
    flags = visibility_flags()
    shown = {status for status, on in flags.items() if on}
    pits = sorted(yard.pits.all(), key=lambda p: (p.row, p.col))
    rows = [pit_json(p) for p in pits if p.status in shown]
    return {"yard": yard.name, "visibility": flags, "rows": rows}


@api.get("/visibility", auth=auth)
def read_visibility(request):
    """显隐专页数据源：管理员与操作工都能看开关。"""
    return visibility_json(get_visibility())


@api.put("/visibility", auth=auth)
def write_visibility(request, payload: VisibilityIn):
    """保存显隐开关：仅管理员；只写开关表，不动已有酸碱数字。"""
    if request.auth.role != "admin":
        raise HttpError(403, "仅管理员可保存坑态显隐开关")
    obj = save_visibility(
        fill=payload.fill,
        tanning=payload.tanning,
        drained=payload.drained,
        operator=request.auth.username,
    )
    return visibility_json(obj)


@api.post("/pits/{pit_id}/samples", auth=auth)
def add_sample(request, pit_id: int, payload: SampleIn):
    pit = Pit.objects.filter(id=pit_id).first()
    if pit is None:
        raise HttpError(404, "坑不存在")
    pit.samples.create(ph=payload.ph, operator=request.auth.username)
    pit.refresh_from_db()
    return pit_json(pit)


@api.post("/pits/{pit_id}/status", auth=auth)
def set_status(request, pit_id: int, payload: StatusIn):
    pit = Pit.objects.filter(id=pit_id).first()
    if pit is None:
        raise HttpError(404, "坑不存在")
    try:
        assert_can_set_status(pit, payload.status)
    except RuleError as exc:
        raise HttpError(400, str(exc))
    pit.status = payload.status
    pit.save(update_fields=["status"])
    return pit_json(pit)
