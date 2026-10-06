import { LitElement, css, html } from "lit";
import { api, LABELS, allOff, fmtTime } from "./api.js";

class LedgerPage extends LitElement {
  static properties = {
    data: { type: Object },
    err: { type: String },
  };

  static styles = css`
    :host { display: block; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border-bottom: 1px solid #d9cbb4; padding: 8px 10px; text-align: left; }
    th { background: #efe6d6; }
    .err { color: #9b1c1c; }
    .hint { color: #6b5a48; font-size: 0.92em; }
    button { font: inherit; padding: 6px 12px; }
  `;

  constructor() {
    super();
    this.data = null;
    this.err = "";
  }

  connectedCallback() {
    super.connectedCallback();
    this.refresh();
  }

  async refresh() {
    try {
      this.data = await api("/api/ledger");
      this.err = "";
    } catch (e) {
      this.err = e.message;
    }
  }

  render() {
    if (!this.data) return html`${this.err ? html`<p class="err">${this.err}</p>` : "装载台账…"}`;
    const rows = this.data.rows;
    return html`
      <h1>酸碱台账</h1>
      <p class="hint">台账跟随「坑态显隐」开关，只列出打开的坑态；拨开关不改库里的酸碱数字。</p>
      <button @click=${this.refresh}>刷新</button>
      ${rows.length === 0
        ? html`<p class="hint">${allOff(this.data.visible) ? "三路开关全关，台账为空。" : "当前开关下没有对应坑态的坑。"}</p>`
        : html`<table>
            <thead>
              <tr><th>坑号</th><th>坑态</th><th>最近酸碱度</th><th>采样次数</th><th>最近采样</th><th>操作人</th></tr>
            </thead>
            <tbody>
              ${rows.map(
                (r) => html`<tr>
                  <td>${r.code}</td>
                  <td>${LABELS[r.status]}</td>
                  <td>${r.latestPh ?? "无"}</td>
                  <td>${r.sampleCount}</td>
                  <td>${fmtTime(r.lastTakenAt)}</td>
                  <td>${r.lastOperator || "—"}</td>
                </tr>`
              )}
            </tbody>
          </table>`}
      ${this.err ? html`<p class="err">${this.err}</p>` : ""}
    `;
  }
}

customElements.define("ledger-page", LedgerPage);
