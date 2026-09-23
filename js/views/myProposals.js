(function (global) {
  'use strict';
  var H = global.Helpers;

  function render(container) {
    var approvedOnly = global.location.hash.indexOf('#/approved') === 0;
    var teamName = global.State.getSelectedTeamName();
    var proposals = global.State.listProposals().filter(function (p) {
      return p.teamName === teamName && (!approvedOnly || p.status === 'accepted');
    }).slice().sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
    container.innerHTML =
      '<div class="stage-header"><div class="eyebrow">СТУДЕНЧЕСКАЯ КОМАНДА · ' + H.escapeHtml(teamName) + '</div>' +
      '<h1>' + (approvedOnly ? 'Одобренные заявки' : 'Мои заявки') + '</h1>' +
      '<p class="muted">' + (approvedOnly ? 'Задачи, для которых бизнес выбрал вашу команду.' : 'Все заявки этой команды и решения бизнеса по ним.') + '</p></div>' +
      '<div class="tab-links"><a href="#/my-proposals" class="' + (!approvedOnly ? 'is-active' : '') + '">Все заявки</a>' +
      '<a href="#/approved" class="' + (approvedOnly ? 'is-active' : '') + '">Одобренные</a></div>' +
      (proposals.length ? '<div class="task-list">' + proposals.map(function (p) {
        var task = global.State.getTask(p.taskId);
        return '<article class="panel proposal-row"><div class="proposal-head"><div><div class="muted small">' +
          H.escapeHtml(task ? task.industry : 'Задача удалена') + ' · подана ' + H.formatDate(p.createdAt) + '</div>' +
          '<h2>' + H.escapeHtml(task ? task.fields.title : 'Задача удалена') + '</h2></div>' +
          '<span class="status-tag status-' + p.status + '">' + H.proposalStatusLabel(p.status) + '</span></div>' +
          '<p><strong>Идея:</strong> ' + H.escapeHtml(p.idea) + '</p><p><strong>План:</strong> ' + H.escapeHtml(p.plan) + '</p>' +
          (p.progressPoints != null ? '<p class="muted small">Баллы за прогресс: ' + H.escapeHtml(p.progressPoints) + '/100</p>' : '') +
          (task ? '<a class="btn btn-ghost btn-sm btn-link" href="#/task/' + task.id + '">Открыть задачу →</a>' : '') +
          '</article>';
      }).join('') + '</div>' : '<div class="panel empty-state"><h2>Пока здесь пусто</h2><p class="muted">' +
        (approvedOnly ? 'Одобренные заявки появятся после решения бизнеса.' : 'Выберите задачу в каталоге и отправьте первую заявку.') +
        '</p><a class="btn btn-primary btn-link" href="#/catalog">Перейти в каталог →</a></div>');
  }

  global.Views = global.Views || {};
  global.Views.myProposals = { render: render };
})(window);
