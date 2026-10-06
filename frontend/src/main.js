import { LitElement, css, html } from "lit";

const TOKEN_KEY = "tanpit_token";
const LABELS = { fill: "注液", tanning: "鞣制中", drained: "已放液" };
const ROLE_LABELS = { admin: "管理员", worker: "操作工" };
const PAGES = [
  { key: "map", label: "坑位场地图" },
  { key: "ledger", label: "酸碱台账" },
  { key: "visibility", label: "坑态显隐" },
];

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body) headers["Content-Type"] = "application/json";
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || "请求失败");
  return data;
}

class TanYard extends LitElement {
  static properties = {
    ready: { type: Boolean },
    user: { type: Object },
    page: { type: String },
    board: { type: Object },
    ledger: { type: Object },
    visibility: { type: Object },
    picked: { type: Object },
    ph: { type: String },
    err: { type: String },
    msg: { type: String },
    username: { type: String },
    password: { type: String },
  };

  static styles = css`
    :host { display: block; font-family: "KaiTi", serif; color: #2b2118; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 28px 16px 50px; }
    .topbar { display: flex; align-items: center; gap: 6px; border-bottom: 2px solid #8a5a2b; padding-bottom: 10px; margin-bottom: 18px; }
    .topbar .brand { font-size: 1.15em; font-weight: bold; margin-right: 14px; }
    .topbar .spacer { flex: 1; }
    .topbar .who { color: #6b5a48; font-size: 0.92em; margin-right: 6px; }
    .tab { border: 1px solid #8a5a2b; background: #fff; color: #8a5a2b; border-radius: 6px; cursor: pointer; }
    .tab.active { background: #8a5a2b; color: #fff; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .pit { min-height: 110px; border-radius: 8px; color: #fff; cursor: pointer; border: 0; }
    .fill { background: #6d8f9e; }
    .tanning { background: #8a5a2b; }
    .drained { background: #5f6f4a; }
    .spectrum { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
    .bar { min-width: 96px; border-radius: 8px; color: #fff; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; }
    table.ledger { border-collapse: collapse; width: 100%; margin-top: 8px; }
    table.ledger th, table.ledger td { border: 1px solid #c9b8a3; padding: 8px 10px; text-align: left; }
    table.ledger th { background: #f0e6d8; }
    .switch { display: flex; align-items: center; gap: 10px; margin: 12px 0; font-size: 1.05em; }
    .switch input { transform: scale(1.4); }
    .err { color: #9b1c1c; }
    .ok { color: #2f6b2f; }
    .hint { color: #6b5a48; font-size: 0.92em; }
    label { display: block; margin: 8px 0; }
    input, button { font: inherit; padding: 8px 10px; margin: 4px 6px 4px 0; }
  `;

  constructor() {
    super();
    this.ready = Boolean(localStorage.getItem(TOKEN_KEY));
    this.user = null;
    this.page = "map";
    this.board = null;
    this.ledger = null;
    this.visibility = null;
    this.picked = null;
    this.ph = "4.2";
    this.err = "";
    this.msg = "";
    this.username = "admin";
    this.password = "123456";
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.ready) this.boot();
  }

  async boot() {
    try {
      this.user = await api("/api/auth/me");
      await this.goto("map");
    } catch (e) {
      this.logout();
    }
  }

  async goto(page) {
    this.page = page;
    this.err = "";
    this.msg = "";
    try {
      if (page === "map") await this.refreshBoard();
      if (page === "ledger") this.ledger = await api("/api/ledger");
      if (page === "visibility") this.visibility = await api("/api/visibility");
    } catch (e) {
      this.err = e.message;
    }
  }

  async refreshBoard() {
    this.board = await api("/api/board");
    if (this.picked) {
      this.picked = this.board.pits.find((p) => p.id === this.picked.id) || this.board.pits[0];
    }
  }

  async login(e) {
    e.preventDefault();
    this.err = "";
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: this.username, password: this.password }),
      });
      localStorage.setItem(TOKEN_KEY, data.access_token);
      this.user = data.user;
      this.ready = true;
      await this.goto("map");
    } catch (ex) {
      this.err = ex.message;
    }
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.ready = false;
    this.user = null;
    this.board = null;
    this.ledger = null;
    this.visibility = null;
    this.picked = null;
    this.err = "";
    this.msg = "";
  }

  async writePh() {
    this.err = "";
    try {
      this.picked = await api(`/api/pits/${this.picked.id}/samples`, {
        method: "POST",
        body: JSON.stringify({ ph: Number(this.ph) }),
      });
      await this.refreshBoard();
    } catch (ex) {
      this.err = ex.message;
    }
  }

  async setStatus(status) {
    this.err = "";
    try {
      this.picked = await api(`/api/pits/${this.picked.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      await this.refreshBoard();
    } catch (ex) {
      this.err = ex.message;
    }
  }

  async saveVisibility() {
    this.err = "";
    this.msg = "";
    try {
      this.visibility = await api("/api/visibility", {
        method: "PUT",
        body: JSON.stringify({
          fill: this.visibility.fill,
          tanning: this.visibility.tanning,
          drained: this.visibility.drained,
        }),
      });
      this.msg = "已保存：酸碱谱与酸碱台账即按此版开关显示";
    } catch (ex) {
      this.err = ex.message;
    }
  }

  renderNav() {
    return html`<nav class="topbar">
      <span class="brand">南冈鞣场</span>
      ${PAGES.map(
        (p) => html`<button
          class="tab ${this.page === p.key ? "active" : ""}"
          @click=${() => this.goto(p.key)}
        >${p.label}</button>`
      )}
      <span class="spacer"></span>
      <span class="who">${this.user?.username} · ${ROLE_LABELS[this.user?.role] || ""}</span>
      <button class="tab" @click=${this.logout}>退出</button>
    </nav>`;
  }

  renderMap() {
    if (!this.board) return html`<p>装载坑位…</p>`;
    const shown = this.board.pits.filter((p) => this.board.visibility[p.status]);
    return html`
      <h2>坑位场地图</h2>
      <p class="hint">${this.board.village} · 点坑登记浸液酸碱度；放液须最近读数 3.5～5.0</p>
      <div class="grid">
        ${this.board.pits.map(
          (p) => html`<button class="pit ${p.status}" @click=${() => (this.picked = p)}>
            <strong>${p.code}</strong><br />${LABELS[p.status]}
          </button>`
        )}
      </div>
      ${this.picked
        ? html`<section>
            <h3>${this.picked.code} · ${LABELS[this.picked.status]}</h3>
            <p>最近酸碱度：${this.picked.latestPh ?? "无"} · ${this.picked.sampleCount} 次</p>
            <input .value=${this.ph} @input=${(e) => (this.ph = e.target.value)} />
            <button @click=${this.writePh}>登记酸碱度</button>
            <div>
              <button @click=${() => this.setStatus("fill")}>注液</button>
              <button @click=${() => this.setStatus("tanning")}>鞣制中</button>
              <button @click=${() => this.setStatus("drained")}>已放液</button>
            </div>
          </section>`
        : ""}
      <h3>酸碱谱</h3>
      ${shown.length
        ? html`<div class="spectrum">
            ${shown.map(
              (p) => html`<div class="bar ${p.status}">
                <strong>${p.code}</strong>
                <span>${LABELS[p.status]} · pH ${p.latestPh ?? "无"}</span>
              </div>`
            )}
          </div>`
        : html`<p class="hint">三路开关全关，酸碱谱为空表</p>`}
    `;
  }

  renderLedger() {
    if (!this.ledger) return html`<p>装载台账…</p>`;
    const rows = this.ledger.rows;
    return html`
      <h2>酸碱台账</h2>
      <p class="hint">台账跟随坑态显隐开关，只列开关打开的坑态</p>
      <table class="ledger">
        <thead>
          <tr><th>坑号</th><th>状态</th><th>最近酸碱度</th><th>登记次数</th></tr>
        </thead>
        <tbody>
          ${rows.map(
            (r) => html`<tr>
              <td>${r.code}</td>
              <td>${LABELS[r.status]}</td>
              <td>${r.latestPh ?? "无"}</td>
              <td>${r.sampleCount}</td>
            </tr>`
          )}
        </tbody>
      </table>
      ${rows.length === 0 ? html`<p class="hint">当前开关下无可见坑态，台账为空表</p>` : ""}
    `;
  }

  renderVisibility() {
    if (!this.visibility) return html`<p>装载开关…</p>`;
    const isAdmin = this.user?.role === "admin";
    return html`
      <h2>坑态显隐</h2>
      <p class="hint">打开的坑态才会出现在场地图下的酸碱谱与酸碱台账；三路全关则两边都是空表。</p>
      ${Object.keys(LABELS).map(
        (k) => html`<label class="switch">
          <input
            type="checkbox"
            .checked=${Boolean(this.visibility[k])}
            ?disabled=${!isAdmin}
            @change=${(e) => {
              this.visibility = { ...this.visibility, [k]: e.target.checked };
            }}
          />
          ${LABELS[k]}
        </label>`
      )}
      ${isAdmin
        ? html`<button @click=${this.saveVisibility}>保存开关</button>`
        : html`<p class="hint">操作工仅可查看开关，保存需管理员账号。</p>`}
    `;
  }

  render() {
    if (!this.ready) {
      return html`<div class="wrap">
        <h1>南冈鞣场</h1>
        <form @submit=${this.login} autocomplete="off">
          <label>用户名
            <input name="username" autocomplete="off" .value=${this.username} @input=${(e) => (this.username = e.target.value)} />
          </label>
          <label>密码
            <input name="password" type="password" autocomplete="off" .value=${this.password} @input=${(e) => (this.password = e.target.value)} />
          </label>
          <p class="hint">已预填 admin / 123456，另有 worker / 123456</p>
          <button>登录</button>
        </form>
        ${this.err ? html`<p class="err">${this.err}</p>` : ""}
      </div>`;
    }
    return html`<div class="wrap">
      ${this.renderNav()}
      ${this.page === "map" ? this.renderMap() : ""}
      ${this.page === "ledger" ? this.renderLedger() : ""}
      ${this.page === "visibility" ? this.renderVisibility() : ""}
      ${this.err ? html`<p class="err">${this.err}</p>` : ""}
      ${this.msg ? html`<p class="ok">${this.msg}</p>` : ""}
    </div>`;
  }
}

customElements.define("tan-yard", TanYard);
