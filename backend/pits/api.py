from django.db import transaction
from ninja import NinjaAPI, Schema
from ninja.errors import HttpError

from pits.auth import BearerAuth, make_token
from pits.models import Pit, User, VisibilitySetting, Yard
from pits.rules import RuleError, assert_can_set_status, latest_ph

api = NinjaAPI(title="TanPit", urls_namespace="tanpit")
auth = BearerAuth()

STATUS_KEYS = ("fill", "tanning", "drained")


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


def load_visibility() -> VisibilitySetting:
    """读取全库唯一一版显隐开关（pk=1，迁移时已建行）。"""
    setting, _ = VisibilitySetting.objects.get_or_create(pk=1)
    return setting


def visible_statuses(setting: VisibilitySetting) -> list[str]:
    return [s for s in STATUS_KEYS if getattr(setting, f"show_{s}")]


def visibility_json(setting: VisibilitySetting) -> dict:
    return {
        "fill": setting.show_fill,
        "tanning": setting.show_tanning,
        "drained": setting.show_drained,
        "updatedBy": setting.updated_by,
        "updatedAt": setting.updated_at,
    }


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
    return {"yard": yard.name, "village": yard.village, "pits": [pit_json(p) for p in pits]}


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


@api.get("/visibility", auth=auth)
def get_visibility(request):
    return visibility_json(load_visibility())


@api.put("/visibility", auth=auth)
def save_visibility(request, payload: VisibilityIn):
    user = request.auth
    if user.role != "admin":
        raise HttpError(403, "仅管理员可保存坑态显隐")
    # 单行整版覆盖：两人同时保存时后提交的一版覆盖前一版，库里始终只有一版。
    # 本端点只写开关行，绝不触碰 LiquorSample 里已有的酸碱数字。
    with transaction.atomic():
        setting = VisibilitySetting.objects.select_for_update().get_or_create(pk=1)[0]
        setting.show_fill = payload.fill
        setting.show_tanning = payload.tanning
        setting.show_drained = payload.drained
        setting.updated_by = user.username
        setting.save()
    return visibility_json(setting)


@api.get("/spectrum", auth=auth)
def spectrum(request):
    """场地图底下的酸碱谱：只列出开关打开的坑态；三路全关则空表。"""
    setting = load_visibility()
    allowed = visible_statuses(setting)
    yard = Yard.objects.prefetch_related("pits__samples").first()
    if yard is None:
        raise HttpError(404, "尚无鞣场")
    pits = sorted((p for p in yard.pits.all() if p.status in allowed), key=lambda p: (p.row, p.col))
    return {"visible": visibility_json(setting), "pits": [pit_json(p) for p in pits]}


@api.get("/ledger", auth=auth)
def ledger(request):
    """酸碱台账：与酸碱谱读同一版开关，只列出开关打开的坑态。"""
    setting = load_visibility()
    allowed = visible_statuses(setting)
    rows = []
    if allowed:
        pits = Pit.objects.filter(status__in=allowed).prefetch_related("samples").order_by("row", "col")
        for pit in pits:
            sample = pit.samples.order_by("-taken_at", "-id").first()
            rows.append(
                {
                    "id": pit.id,
                    "code": pit.code,
                    "status": pit.status,
                    "latestPh": None if sample is None else sample.ph,
                    "sampleCount": pit.samples.count(),
                    "lastTakenAt": None if sample is None else sample.taken_at,
                    "lastOperator": "" if sample is None else sample.operator,
                }
            )
    return {"visible": visibility_json(setting), "rows": rows}
