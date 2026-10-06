import { LitElement, css, html } from "lit";
import { api, TOKEN_KEY } from "./api.js";
import "./map-page.js";
import "./ledger-page.js";
import "./visibility-page.js";

const ROUTES = { map: "坑位场地图", ledger: "酸碱台账", visibility: "坑态显隐" };

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, "");
  return ROUTES[h] ? h : "map";
}

class TanYard extends LitElement {
  static properties = {
    ready: { type: Boolean },
    me: { type: Object },
    route: { type: String },
    err: { type: String },
    username: { type: String },
    password: { type: String },
  };

  static styles = css`
    :host { display: block; font-family: "KaiTi", serif; color: #2b2118; }
    .top {
      display: flex; align-items: center; gap: 18px; flex-wrap: wrap;
      background: #3a2c1e; color: #f3e9d7; padding: 10px 18px;
    }
    .brand { font-size: 1.15em; font-weight: bold; letter-spacing: 2px; }
    nav { display: flex; gap: 4px; }
    nav a {
      color: #d8c8ae; text-decoration: none; padding: 6px 14px; border-radius: 6px;
    }
    nav a.on { background: #8a5a2b; color: #fff; }
    nav a:hover { color: #fff; }
    .who { margin-left: auto; font-size: 0.92em; color: #d8c8ae; }
    .top button {
      font: inherit; background: transparent; color: #f3e9d7;
      border: 1px solid #8a5a2b; border-radius: 6px; padding: 4px 12px; cursor: pointer;
    }
    main { max-width: 880px; margin: 0 auto; padding: 28px 16px 50px; }
    .err { color: #9b1c1c; }
    .hint { color: #6b5a48; font-size: 0.92em; }
    label { display: block; margin: 8px 0; }
    input, button { font: inherit; padding: 8px 10px; margin: 4px 6px 4px 0; }
  `;

  constructor() {
    super();
    this.ready = Boolean(localStorage.getItem(TOKEN_KEY));
    this.me = null;
    this.route = currentRoute();
    this.err = "";
    this.username = "admin";
    this.password = "123456";
  }

  connectedCallback() {
    super.connectedCallback();
    this._onHash = () => {
      this.route = currentRoute();
    };
    window.addEventListener("hashchange", this._onHash);
    if (this.ready) this.loadMe();
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this._onHash);
    super.disconnectedCallback();
  }

  async loadMe() {
    try {
      this.me = await api("/api/auth/me");
    } catch (e) {
      this.logout();
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
      this.ready = true;
      this.me = data.user;
      if (!location.hash) location.hash = "#/map";
    } catch (ex) {
      this.err = ex.message;
    }
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    this.ready = false;
    this.me = null;
  }

  renderLogin() {
    return html`<main>
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
    </main>`;
  }

  renderPage() {
    if (!this.me) return html`<main>装载…</main>`;
    if (this.route === "ledger") return html`<ledger-page></ledger-page>`;
    if (this.route === "visibility") return html`<visibility-page .role=${this.me.role}></visibility-page>`;
    return html`<map-page></map-page>`;
  }

  render() {
    if (!this.ready) return this.renderLogin();
    return html`
      <header class="top">
        <span class="brand">南冈鞣场</span>
        <nav>
          ${Object.entries(ROUTES).map(
            ([key, label]) => html`<a class=${this.route === key ? "on" : ""} href="#/${key}">${label}</a>`
          )}
        </nav>
        ${this.me
          ? html`<span class="who">${this.me.username}（${this.me.role === "admin" ? "管理员" : "操作工"}）</span>
              <button @click=${this.logout}>退出</button>`
          : ""}
      </header>
      ${this.renderPage()}
    `;
  }
}

customElements.define("tan-yard", TanYard);
