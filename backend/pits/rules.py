"""鞣坑放液门槛：最近一次浸液酸碱度须在 3.5～5.0。"""

from django.db import transaction

from pits.models import Pit, VisibilitySetting

MIN_PH = 3.5
MAX_PH = 5.0


class RuleError(ValueError):
    pass


def latest_ph(pit: Pit) -> float | None:
    sample = pit.samples.order_by("-taken_at", "-id").first()
    return None if sample is None else sample.ph


def assert_can_set_status(pit: Pit, new_status: str) -> None:
    allowed = {Pit.STATUS_FILL, Pit.STATUS_TANNING, Pit.STATUS_DRAINED}
    if new_status not in allowed:
        raise RuleError(f"无效状态：{new_status}")
    if new_status != Pit.STATUS_DRAINED:
        return
    ph = latest_ph(pit)
    if ph is None:
        raise RuleError("该坑尚无浸液酸碱记录，不能放液")
    if ph < MIN_PH or ph > MAX_PH:
        raise RuleError(f"最近酸碱度 {ph} 不在 {MIN_PH}～{MAX_PH}，不能放液")


def get_visibility() -> VisibilitySetting:
    """读取唯一一版显隐开关；库里还没有就按默认全开补一行。"""
    obj = VisibilitySetting.objects.order_by("id").first()
    if obj is None:
        obj = VisibilitySetting.objects.create()
    return obj


def visibility_flags() -> dict:
    obj = get_visibility()
    return {
        Pit.STATUS_FILL: obj.show_fill,
        Pit.STATUS_TANNING: obj.show_tanning,
        Pit.STATUS_DRAINED: obj.show_drained,
    }


def save_visibility(*, fill: bool, tanning: bool, drained: bool, operator: str) -> VisibilitySetting:
    """保存唯一一版开关。

    行锁串行化：两名班长同时保存时后提交者覆盖先提交者，库里只留一版。
    只写 VisibilitySetting，绝不触碰 LiquorSample 里已有的酸碱数字。
    """
    with transaction.atomic():
        obj = VisibilitySetting.objects.select_for_update().order_by("id").first()
        if obj is None:
            obj = VisibilitySetting()
        obj.show_fill = fill
        obj.show_tanning = tanning
        obj.show_drained = drained
        obj.updated_by = operator
        obj.save()
    return obj
