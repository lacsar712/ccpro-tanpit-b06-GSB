import { LitElement, css, html } from "lit";
import { api, LABELS, STATUS_ORDER, fmtTime } from "./api.js";

class VisibilityPage extends LitElement {
  static properties = {
    role: { type: String },
    saved: { type: Object },
    draft: { type: Object },
    msg: { type: String },
    err: { type: String },
  };

  static styles = css`
    :host { display: block; }
    .sw-row {
      display: flex; align-items: center; gap: 14px;
      padding: 12px 4px; border-bottom: 1px solid #d9cbb4;
    }
    .sw-label { width: 90px; font-weight: bold; }
    .switch { position: relative; display: inline-block; width: 52px; height: 28px; }
    .switch input { opacity: 0; width: 0; height: 0; margin: 0; }
    .knob {
      position: absolute; inset: 0; border-radius: 28px; background: #b9a98f;
      transition: background 0.15s; cursor: pointer;
    }
    .knob::before {
      content: ""; position: absolute; left: 4px; top: 4px; width: 20px; height: 20px;
      border-radius: 50%; background: #fff; transition: transform 0.15s;
    }
    input:checked + .knob { background: #5f6f4a; }
    input:checked + .knob::before { transform: translateX(24px); }
    input:disabled + .knob { cursor: not-allowed; opacity: 0.65; }
    .state { color: #6b5a48; }
    .err { color: #9b1c1c; }
    .ok { color: #5f6f4a; }
    .hint { color: #6b5a48; font-size: 0.92em; }
    button { font: inherit; padding: 8px 18px; margin-top: 14px; }
  `;

  constructor() {
    super();
    this.role = "worker";
    this.saved = null;
    this.draft = null;
    this.msg = "";
    this.err = "";
  }

  connectedCallback() {
    super.connectedCallback();
    this.refresh();
  }

  get isAdmin() {
    return this.role === "admin";
  }

  async refresh() {
    try {
      const v = await api("/api/visibility");
      this.saved = v;
      this.draft = { fill: v.fill, tanning: v.tanning, drained: v.drained };
      this.err = "";
    } catch (e) {
      this.err = e.message;
    }
  }

  async save() {
    this.msg = "";
    this.err = "";
    try {
      const v = await api("/api/visibility", { method: "PUT", body: JSON.stringify(this.draft) });
      this.saved = v;
      this.draft = { fill: v.fill, tanning: v.tanning, drained: v.drained };
      this.msg = "已保存。场地图酸碱谱与酸碱台账即刻按这版开关显示。";
    } catch (e) {
      this.err = e.message;
    }
  }

  renderRow(key) {
    return html`<div class="sw-row">
      <span class="sw-label">${LABELS[key]}</span>
      <label class="switch">
        <input
          type="checkbox"
          ?disabled=${!this.isAdmin}
          .checked=${this.draft[key]}
          @change=${(e) => (this.draft = { ...this.draft, [key]: e.target.checked })}
        />
        <span class="knob"></span>
      </label>
      <span class="state">${this.draft[key] ? "显示" : "隐藏"}</span>
    </div>`;
  }

  render() {
    if (!this.draft) return html`${this.err ? html`<p class="err">${this.err}</p>` : "装载开关…"}`;
    return html`
      <h1>坑态显隐</h1>
      <p class="hint">
        开关控制场地图底下的酸碱谱与酸碱台账显示哪些坑态；三路全关则两边都是空表。
        拨开关不改库里已有的酸碱数字。全库只保存一版，后保存的覆盖先保存的。
      </p>
      ${STATUS_ORDER.map((k) => this.renderRow(k))}
      ${this.isAdmin
        ? html`<button @click=${this.save}>保存开关</button>`
        : html`<p class="hint">操作工仅可查看开关状态，保存需管理员。</p>`}
      ${this.saved.updatedBy
        ? html`<p class="hint">最近由 ${this.saved.updatedBy} 保存于 ${fmtTime(this.saved.updatedAt)}</p>`
        : ""}
      ${this.msg ? html`<p class="ok">${this.msg}</p>` : ""}
      ${this.err ? html`<p class="err">${this.err}</p>` : ""}
    `;
  }
}

customElements.define("visibility-page", VisibilityPage);
