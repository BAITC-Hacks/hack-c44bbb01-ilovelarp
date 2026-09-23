(function (global) {
  'use strict';
  var H = global.Helpers;

  function render(container) {
    var tasks = global.State.listTasks();
    var drafts = tasks.filter(function (t) { return t.status === 'draft'; });
    var published = tasks.filter(function (t) { return t.status === 'published'; });

    container.innerHTML =
      '<div class="stage-header"><h1>Мои задачи</h1><p class="muted">Черновики видите только вы. Опубликованные — видит весь каталог.</p></div>' +
      section('Черновики', drafts, 'Пока нет черновиков — создайте новую задачу.') +
      section('Опубликовано в каталоге', published, 'Пока ничего не опубликовано.');

    container.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { global.Router.navigate('/wizard/' + btn.getAttribute('data-edit')); });
    });
    container.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.addEventListener('click', function () { global.Router.navigate('/task/' + btn.getAttribute('data-view')); });
    });
    container.querySelectorAll('[data-inbox]').forEach(function (btn) {
      btn.addEventListener('click', function () { global.Router.navigate('/inbox/' + btn.getAttribute('data-inbox')); });
    });
    container.querySelectorAll('[data-delete]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (confirm('Удалить эту задачу и все отклики на неё?')) {
          global.State.deleteTask(btn.getAttribute('data-delete'));
          render(container);
        }
      });
    });
  }

  function section(title, tasks, emptyText) {
    if (!tasks.length) return '<h2 class="section-title">' + title + '</h2><p class="muted">' + emptyText + '</p>';
    return '<h2 class="section-title">' + title + '</h2><div class="task-list">' + tasks.map(rowHtml).join('') + '</div>';
  }

  function rowHtml(t) {
    var proposalsCount = global.State.listProposals({ taskId: t.id }).length;
    return '<div class="panel task-row">' +
      '<div class="task-row-main">' +
        '<button type="button" class="task-title-button" data-view="' + t.id + '">' + H.escapeHtml(t.fields.title || '(без названия)') + '</button>' +
        '<div class="muted small">' + H.escapeHtml(t.industry || 'Отрасль не указана') + ' · обновлено ' + H.formatDate(t.updatedAt) + '</div>' +
      '</div>' +
      H.levelBadgeHtml(t.rating.level, t.rating.total) +
      '<div class="task-row-actions">' +
        '<button class="btn btn-ghost btn-sm" data-view="' + t.id + '">Просмотреть</button>' +
        '<button class="btn btn-ghost btn-sm" data-edit="' + t.id + '">Редактировать</button>' +
        (t.status === 'published' ? '<button class="btn btn-ghost btn-sm" data-inbox="' + t.id + '">Отклики (' + proposalsCount + ')</button>' : '') +
        '<button class="btn btn-ghost btn-sm btn-danger" data-delete="' + t.id + '">Удалить</button>' +
      '</div>' +
    '</div>';
  }

  global.Views = global.Views || {};
  global.Views.myTasks = { render: render };
})(window);
