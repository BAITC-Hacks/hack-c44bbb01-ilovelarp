// Шаг 5-6 сценария: общий каталог, доступный всем командам, с сортировкой и фильтрами.
(function (global) {
  'use strict';
  var C = global.Constants;
  var H = global.Helpers;

  function render(container) {
    var state = { sort: 'rating-desc', industry: '', level: '' };

    function paint() {
      var tasks = global.State.listTasks({ status: 'published' });
      var industries = Array.from(new Set(C.INDUSTRIES.concat(tasks.map(function (t) { return t.industry; }).filter(Boolean)))).sort();
      if (state.industry) tasks = tasks.filter(function (t) { return t.industry === state.industry; });
      if (state.level) tasks = tasks.filter(function (t) { return t.rating.level.key === state.level; });
      tasks = tasks.slice().sort(function (a, b) {
        if (state.sort === 'rating-desc') return b.rating.total - a.rating.total;
        if (state.sort === 'rating-asc') return a.rating.total - b.rating.total;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      container.innerHTML =
        '<div class="stage-header"><div class="eyebrow">СТУДЕНЧЕСКАЯ КОМАНДА</div><h1>Каталог задач</h1><p class="muted">Выберите подходящую задачу и предложите свой план работы.</p>' +
        '<div class="actions"><a class="btn btn-ghost btn-link" href="#/my-proposals">Мои заявки →</a><a class="btn btn-ghost btn-link" href="#/approved">Одобренные заявки →</a></div></div>' +
        '<div class="panel filters">' +
          select('f-sort', [
            ['rating-desc', 'Сначала высокий рейтинг'], ['rating-asc', 'Сначала низкий рейтинг'], ['new', 'Сначала новые']
          ], state.sort) +
          select('f-industry', [['', 'Все отрасли']].concat(industries.map(function (i) { return [i, i]; })), state.industry) +
          select('f-level', [['', 'Все уровни']].concat(C.LEVELS.map(function (l) { return [l.key, l.label]; })), state.level) +
        '</div>' +
        (tasks.length ? '<div class="task-list">' + tasks.map(cardHtml).join('') + '</div>'
          : '<p class="muted">Нет задач под текущие фильтры.</p>');

      container.querySelector('#f-sort').addEventListener('change', function (e) { state.sort = e.target.value; paint(); });
      container.querySelector('#f-industry').addEventListener('change', function (e) { state.industry = e.target.value; paint(); });
      container.querySelector('#f-level').addEventListener('change', function (e) { state.level = e.target.value; paint(); });
      container.querySelectorAll('[data-open]').forEach(function (btn) {
        btn.addEventListener('click', function () { global.Router.navigate('/task/' + btn.getAttribute('data-open')); });
      });
    }

    function select(id, options, value) {
      return '<select id="' + id + '" class="input input-inline">' + options.map(function (o) {
        return '<option value="' + H.escapeHtml(o[0]) + '"' + (o[0] === value ? ' selected' : '') + '>' + H.escapeHtml(o[1]) + '</option>';
      }).join('') + '</select>';
    }

    function cardHtml(t) {
      var snippet = (t.fields.context || '').slice(0, 140);
      return '<div class="panel catalog-card" data-open="' + t.id + '">' +
        '<div class="catalog-card-top">' + H.levelBadgeHtml(t.rating.level, t.rating.total) +
          '<span class="muted small">' + H.escapeHtml(t.industry || '—') + '</span></div>' +
        '<div class="task-row-title">' + H.escapeHtml(t.fields.title || '(без названия)') + '</div>' +
        '<p class="muted small">' + H.escapeHtml(snippet) + (snippet.length === 140 ? '…' : '') + '</p>' +
        '<button class="btn btn-ghost btn-sm" data-open="' + t.id + '">Открыть →</button>' +
      '</div>';
    }

    paint();
  }

  global.Views = global.Views || {};
  global.Views.catalog = { render: render };
})(window);
