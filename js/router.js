// Простой хэш-роутер без зависимостей. Каждый view — объект с методом render(container, params).
(function (global) {
  'use strict';

  var routes = []; // { pattern: ['wizard', ':id'], view }
  var mainEl = null;

  function register(pattern, view) {
    routes.push({ parts: pattern.split('/').filter(Boolean), view: view });
  }

  function matchRoute(hashPath) {
    var parts = hashPath.split('/').filter(Boolean);
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      if (r.parts.length !== parts.length) continue;
      var params = {}; var ok = true;
      for (var j = 0; j < r.parts.length; j++) {
        if (r.parts[j].charAt(0) === ':') params[r.parts[j].slice(1)] = parts[j];
        else if (r.parts[j] !== parts[j]) { ok = false; break; }
      }
      if (ok) return { view: r.view, params: params };
    }
    return null;
  }

  function currentPath() {
    return (global.location.hash || '#/').slice(1);
  }

  function navigate(path) {
    global.location.hash = path;
  }

  function renderNav() {
    var role = global.State.getRole();
    var navEl = document.getElementById('nav');
    var items = role === 'business'
      ? [
          { path: '/wizard', label: 'Новая задача' },
          { path: '/my-tasks', label: 'Мои задачи' },
          { path: '/inbox', label: 'Входящие отклики' }
        ]
      : [
          { path: '/catalog', label: 'Каталог задач' },
          { path: '/my-proposals', label: 'Мои заявки' },
          { path: '/approved', label: 'Одобренные заявки' }
        ];
    var current = currentPath();
    navEl.innerHTML = items.map(function (it) {
      var active = current.indexOf(it.path) === 0 ? ' is-active' : '';
      return '<a class="nav-link' + active + '" href="#' + it.path + '">' + it.label + '</a>';
    }).join('');
  }

  function renderCurrent() {
    var path = currentPath();
    var match = matchRoute(path);
    renderNav();
    if (!match) {
      var role = global.State.getRole();
      navigate(role === 'business' ? '/wizard' : '/catalog');
      return;
    }
    mainEl.innerHTML = '';
    match.view.render(mainEl, match.params);
  }

  function init(container) {
    mainEl = container;
    global.addEventListener('hashchange', renderCurrent);
    renderCurrent();
  }

  global.Router = { register: register, init: init, navigate: navigate, renderNav: renderNav, refresh: renderCurrent };
})(window);
