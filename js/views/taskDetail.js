// Просмотр задачи глазами команды + форма отклика (идея, план, срок, ссылка на прототип).
(function (global) {
  'use strict';
  var C = global.Constants;
  var H = global.Helpers;

  function render(container, params) {
    var task = global.State.getTask(params.id);
    if (!task) { container.innerHTML = '<p class="muted">Задача не найдена.</p>'; return; }
    if (global.State.getRole() === 'business') { renderBusinessTask(container, task); return; }
    if (task.status !== 'published') { container.innerHTML = '<p class="muted">Задача ещё не опубликована.</p>'; return; }

    function paint() {
      var teamName = global.State.getSelectedTeamName();
      var myProposals = global.State.listProposals({ taskId: task.id }).filter(function (p) { return p.teamName === teamName; });
      container.innerHTML =
        '<div class="stage-header"><a class="back-link" href="#/catalog">← В каталог</a>' +
          '<h1>' + H.escapeHtml(task.fields.title || '(без названия)') + '</h1>' +
          H.levelBadgeHtml(task.rating.level, task.rating.total) +
          '<span class="muted small"> · ' + H.escapeHtml(task.industry || '—') + '</span></div>' +
        '<div class="card-layout">' +
          '<div class="panel">' +
            C.FIELDS.filter(function (f) { return f.key !== 'title'; }).map(function (f) {
              return '<div class="ro-field"><div class="field-label">' + f.label + '</div>' +
                '<div class="ro-value">' + (task.fields[f.key] ? H.escapeHtml(task.fields[f.key]) : '<span class="muted">не указано</span>') + '</div></div>';
            }).join('') +
          '</div>' +
          '<div class="panel">' + H.ratingBreakdownHtml(task.rating) + '</div>' +
        '</div>' +
        '<h2 class="section-title">Откликнуться</h2>' +
        '<div class="panel">' +
          '<div class="team-note">Заявка от команды <strong>' + H.escapeHtml(teamName) + '</strong>. Команду можно сменить в боковой панели.</div>' +
          '<label class="field-label">Идея решения</label><textarea id="p-idea" class="input"></textarea>' +
          '<label class="field-label">План работы</label><textarea id="p-plan" class="input"></textarea>' +
          '<label class="field-label">Срок</label><input id="p-deadline" class="input" type="date">' +
          '<label class="field-label">Ссылка на прототип (необязательно)</label><input id="p-link" class="input" type="url" placeholder="https://…">' +
          '<div class="actions"><button id="p-submit" class="btn btn-primary">Отправить отклик</button></div>' +
        '</div>' +
        (myProposals.length ? '<h2 class="section-title">Заявки вашей команды на эту задачу</h2><div class="task-list">' +
          myProposals.map(function (p) {
            return '<div class="panel proposal-row"><div class="proposal-head"><strong>' + H.escapeHtml(p.teamName) + '</strong>' +
              '<span class="status-tag status-' + p.status + '">' + H.proposalStatusLabel(p.status) + '</span></div></div>';
          }).join('') + '</div>' : '');

      container.querySelector('#p-submit').addEventListener('click', function () {
        var idea = container.querySelector('#p-idea').value.trim();
        var plan = container.querySelector('#p-plan').value.trim();
        if (!teamName || !idea || !plan) { alert('Заполните название команды, идею и план.'); return; }
        global.State.addProposal({
          taskId: task.id, teamName: teamName, idea: idea, plan: plan,
          deadline: container.querySelector('#p-deadline').value,
          prototypeLink: container.querySelector('#p-link').value.trim()
        });
        paint();
      });
    }

    paint();
  }

  function renderBusinessTask(container, task) {
    var proposals = global.State.listProposals({ taskId: task.id });
    container.innerHTML =
      '<div class="stage-header"><a class="back-link" href="#/my-tasks">← Мои задачи</a>' +
      '<div class="eyebrow">ПРОСМОТР КАРТОЧКИ · ' + (task.status === 'published' ? 'ОПУБЛИКОВАНА' : 'ЧЕРНОВИК') + '</div>' +
      '<h1>' + H.escapeHtml(task.fields.title || '(без названия)') + '</h1>' +
      '<p class="muted">' + H.escapeHtml(task.industry || 'Отрасль не указана') + ' · обновлено ' + H.formatDate(task.updatedAt) + '</p>' +
      '<div class="actions"><a class="btn btn-primary btn-link" href="#/wizard/' + task.id + '">Редактировать карточку</a>' +
      (task.status === 'published' ? '<a class="btn btn-ghost btn-link" href="#/inbox/' + task.id + '">Отклики (' + proposals.length + ')</a>' : '') + '</div></div>' +
      '<div class="card-layout"><div class="panel">' + C.FIELDS.filter(function (f) { return f.key !== 'title'; }).map(function (f) {
        return '<div class="ro-field"><div class="field-label">' + f.label + '</div><div class="ro-value">' +
          (task.fields[f.key] ? H.escapeHtml(task.fields[f.key]) : '<span class="muted">Не указано</span>') + '</div></div>';
      }).join('') + '</div><div class="panel"><h3>Готовность задачи</h3>' + H.levelBadgeHtml(task.rating.level, task.rating.total) +
      H.ratingBreakdownHtml(task.rating) + H.ratingTipsHtml(task.rating) + '</div></div>';
  }

  global.Views = global.Views || {};
  global.Views.taskDetail = { render: render };
})(window);
