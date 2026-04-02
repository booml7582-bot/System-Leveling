// ============================================
// SOLO LEVELING SYSTEM — Hash Router
// ============================================

export class Router {
  constructor() {
    this.routes = {};
    this.currentRoute = null;
    this.beforeEach = null;
    this._onHashChange = this._onHashChange.bind(this);
    window.addEventListener('hashchange', this._onHashChange);
  }

  route(path, handler) {
    this.routes[path] = handler;
    return this;
  }

  guard(fn) {
    this.beforeEach = fn;
    return this;
  }

  async navigate(path) {
    if (window.location.hash === `#${path}`) {
      await this._resolve(path);
    } else {
      window.location.hash = path;
    }
  }

  async _onHashChange() {
    const hash = window.location.hash.slice(1) || '/';
    await this._resolve(hash);
  }

  async _resolve(path) {
    if (this.beforeEach) {
      const redirectPath = await this.beforeEach(path);
      if (redirectPath && redirectPath !== path) {
        window.location.hash = redirectPath;
        return;
      }
    }

    const handler = this.routes[path];
    if (handler) {
      const container = document.getElementById('page-container');
      if (container) {
        container.style.animation = 'none';
        container.offsetHeight; // reflow
        container.style.animation = '';

        this.currentRoute = path;
        await handler(container);
        this._updateNav(path);
      }
    } else {
      // fallback to dashboard or setup
      this.navigate('/dashboard');
    }
  }

  _updateNav(path) {
    document.querySelectorAll('.nav-item').forEach(item => {
      const route = item.dataset.route;
      item.classList.toggle('active', route === path);
    });
  }

  start() {
    const hash = window.location.hash.slice(1) || '/';
    this._resolve(hash);
  }

  destroy() {
    window.removeEventListener('hashchange', this._onHashChange);
  }
}
