import { LitElement, css, html } from "lit";
import { api, LABELS, allOff } from "./api.js";

class MapPage extends LitElement {
  static properties = {
    board: { type: Object },
    spectrum: { type: Object },
    picked: { type: Object },
    ph: { type: String },
    err: { type: String },
  };

  static styles = css`
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .pit { min-height: 110px; border-radius: 8px; color: #fff; cursor: pointer; border: 0; font: inherit; }
    .fill { background: #6d8f9e; }
    .tanning { background: #8a5a2b; }
    .drained { background: #5f6f4a; }
    .err { color: #9b1c1c; }
    .hint { color: #6b5a48; font-size: 0.92em; }
    input, button { font: inherit; padding: 8px 10px; margin: 4px 6px 4px 0; }
    .spectrum { margin-top: 34px; border-top: 2px solid #8a5a2b; padding-top: 10px; }
    .bar-row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    .bar-code { width: 52px; text-align: right; }
    .bar-track {
      flex: 1; height: 20px; background: #efe6d6; border-radius: 4px;
      position: relative; overflow: hidden;
    }
    .bar-fill { display: block; height: 100%; border-radius: 4px 0 0 4px; }
    .bar-none { color: #a4917c; font-size: 0.85em; line-height: 20px; padding-left: 8px; }
    .bar-val { width: 44px; font-variant-numeric: tabular-nums; }
  `;

  constructor() {
    super();
    this.board = null;
    this.spectrum = null;
    this.picked = null;
    this.ph = "4.2";
    this.err = "";
  }

  connectedCallback() {
    super.connectedCallback();
    this.refresh();
  }

  async refresh() {
    try {
      const [board, spectrum] = await Promise.all([api("/api/board"), api("/api/spectrum")]);
      this.board = board;
      this.spectrum = spectrum;
      this.err = "";
      if (this.picked) {
        this.picked = board.pits.find((p) => p.id === this.picked.id) || null;
      }
    } catch (e) {
      this.err = e.message;
    }
  }

  async writePh() {
    this.err = "";
    try {
      this.picked = await api(`/api/pits/${this.picked.id}/samples`, {
        method: "POST",
        body: JSON.stringify({ ph: Number(this.ph) }),
      });
      await this.refresh();
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
      await this.refresh();
    } catch (ex) {
      this.err = ex.message;
    }
  }

  renderSpectrum() {
    const s = this.spectrum;
    if (!s) return "";
    return html`<section class="spectrum">
      <h2>酸碱谱 <span class="hint">（只显示「坑态显隐」里打开的坑态）</span></h2>
      ${s.pits.length === 0
        ? html`<p class="hint">${allOff(s.visible) ? "三路开关全关，酸碱谱为空。" : "当前开关下没有对应坑态的坑。"}</p>`
        : s.pits.map(
            (p) => html`<div class="bar-row">
              <span class="bar-code">${p.code}</span>
              <span class="bar-track">
                ${p.latestPh == null
                  ? html`<span class="bar-none">无读数</span>`
                  : html`<span class="bar-fill ${p.status}" style="width:${(p.latestPh / 14) * 100}%"></span>`}
              </span>
              <span class="bar-val">${p.latestPh ?? "—"}</span>
            </div>`
          )}
    </section>`;
  }

  render() {
    if (!this.board) return html`${this.err ? html`<p class="err">${this.err}</p>` : "装载坑位…"}`;
    return html`
      <h1>${this.board.yard}</h1>
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
      ${this.renderSpectrum()}
      ${this.err ? html`<p class="err">${this.err}</p>` : ""}
    `;
  }
}

customElements.define("map-page", MapPage);
