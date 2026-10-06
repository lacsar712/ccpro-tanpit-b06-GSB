# TanPit-01 · 南冈鞣场

鞣坑场地图作业台。登录后是按行列铺开的坑位，点坑登记浸液酸碱度并改状态。

## 技术栈

| 层 | 技术 |
| --- | --- |
| Web API | Django 5 · Django Ninja（不是 DRF 视图集） |
| 结构 | Django app `pits`：models / rules / api 分文件 |
| 数据 | Django ORM · PostgreSQL 15 |
| 前端 | Lit 3 Web Component · Vite |
| 部署 | Docker Compose |

## 路径与端口

- 前端：http://localhost:4770
- API：http://localhost:8770
- PostgreSQL：localhost:6170

## 演示账号

`admin` / `123456`，`worker` / `123456`

## 业务规则

坑不可标「已放液」，除非最近一次浸液酸碱度在 **3.5～5.0**。规则在 `backend/pits/rules.py`。

## 页面与坑态显隐

顶栏三页：**坑位场地图**（坑格 + 页底酸碱谱）、**酸碱台账**、**坑态显隐**。

- 坑态显隐专页列出注液 / 鞣制中 / 已放液三路开关；管理员可保存，操作工只读。
- 只有打开的坑态才会出现在场地图页底的酸碱谱和酸碱台账里；三路全关则两边都是空表。
- 开关全库只存一版（`VisibilitySetting` 单行，行锁串行化保存），拨开关不会改动已有酸碱记录。

## 接口

- `GET /api/board`：坑格全量 + 当前 `visibility` 开关
- `GET /api/ledger`：按开关过滤后的台账行
- `GET /api/visibility`：读开关（登录即可）
- `PUT /api/visibility`：存开关（仅管理员，否则 403）

## 快速启动

```bash
cd TanPit/TanPit-01
docker compose up --build
```
