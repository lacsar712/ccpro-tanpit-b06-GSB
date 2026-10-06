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

## 坑态显隐

顶栏可进「坑位场地图」「酸碱台账」「坑态显隐」三页。显隐页列出注液 / 鞣制中 / 已放液三路开关：

- 仅管理员可保存；操作工打开显隐页只能看开关。
- 打开的坑态才出现在场地图底下的酸碱谱与酸碱台账里；三路全关则两边都是空表。
- 拨开关只写开关行，不改库里已有的酸碱数字。
- 全库只留一版开关（单行整版覆盖），两人同时保存时后保存的覆盖先保存的，谱条与台账都跟随留下的那版。

## 快速启动

```bash
cd TanPit/TanPit-01
docker compose up --build
```
