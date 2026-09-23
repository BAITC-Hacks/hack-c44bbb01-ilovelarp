// Шаги 6-8 сценария: бизнес видит отклики и сам решает, принять/отклонить.
// Автоматическое назначение команды запрещено кейсом — только ручные действия.
(function (global) {
  'use strict';
  var H = global.Helpers;

  function render(container, params) {
    if (!params.taskId) { renderPicker(container); return; }
    renderTaskInbox(container, params.taskId);
  }

  function renderPicker(container) {
    var published = global.State.listTasks({ status: 'published' });
    container.innerHTML =
      '<div class="stage-header"><h1>Входящие отклики</h1><p class="muted">Выберите задачу, чтобы посмотреть отклики команд.</p></div>' +
      (published.length ? '<div class="task-list">' + published.map(function (t) {
        var count = global.State.listProposals({ taskId: t.id }).length;
        var newCount = global.State.listProposals({ taskId: t.id }).filter(function (p) { return global.State.isProposalNew(p.id); }).length;
        return '<div class="panel task-row"><div class="task-row-main">' +
          '<div class="task-row-title">' + H.escapeHtml(t.fields.title || '(без названия)') + '</div>' +
          '<div class="muted small">' + count + ' откликов</div></div>' +
          (newCount ? '<span class="new-count">' + newCount + ' новых</span>' : '') +
          '<button class="btn btn-ghost btn-sm" data-open="' + t.id + '">Открыть</button></div>';
      }).join('') + '</div>' : '<p class="muted">Пока нет опубликованных задач.</p>');

    container.querySelectorAll('[data-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { global.Router.navigate('/inbox/' + btn.getAttribute('data-open')); });
    });
  }

  function renderTaskInbox(container, taskId) {
    var task = global.State.getTask(taskId);
    if (!task) { container.innerHTML = '<p class="muted">Задача не найдена.</p>'; return; }
    var proposals = global.State.listProposals({ taskId: taskId });

    container.innerHTML =
      '<div class="stage-header"><a class="back-link" href="#/inbox">← Все входящие</a><div class="eyebrow">РУЧНОЙ ВЫБОР КОМАНДЫ</div><h1>Отклики: ' + H.escapeHtml(task.fields.title || '(без названия)') + '</h1>' +
      '<p class="muted">Сравните идеи и планы. Можно одобрить несколько команд или не выбирать ни одну.</p>' +
      H.levelBadgeHtml(task.rating.level, task.rating.total) + ' <a class="inline-link" href="#/task/' + task.id + '">Открыть карточку задачи →</a></div>' +
      (proposals.length ? proposals.map(proposalHtml).join('') : '<p class="muted">Пока никто не откликнулся.</p>');

    container.querySelectorAll('[data-accept]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        global.State.markProposalSeen(btn.getAttribute('data-accept'));
        global.State.updateProposal(btn.getAttribute('data-accept'), { status: 'accepted' });
        renderTaskInbox(container, taskId);
      });
    });
    container.querySelectorAll('[data-decline]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        global.State.markProposalSeen(btn.getAttribute('data-decline'));
        global.State.updateProposal(btn.getAttribute('data-decline'), { status: 'declined' });
        renderTaskInbox(container, taskId);
      });
    });
    container.querySelectorAll('[data-seen]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        global.State.markProposalSeen(btn.getAttribute('data-seen'));
        renderTaskInbox(container, taskId);
      });
    });
    container.querySelectorAll('[data-reconsider]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        global.State.updateProposal(btn.getAttribute('data-reconsider'), { status: 'pending', progressPoints: null });
        renderTaskInbox(container, taskId);
      });
    });
    container.querySelectorAll('[data-save-points]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-save-points');
        var val = container.querySelector('[data-points-input="' + id + '"]').value;
        if (val !== '' && (!Number.isFinite(Number(val)) || Number(val) < 0 || Number(val) > 100)) {
          container.querySelector('[data-points-input="' + id + '"]').focus(); return;
        }
        global.State.updateProposal(id, { progressPoints: val === '' ? null : Number(val) });
        renderTaskInbox(container, taskId);
      });
    });
  }

  function proposalHtml(p) {
    var statusClass = 'status-' + p.status;
    var isNew = global.State.isProposalNew(p.id);
    var prototypeUrl = H.safeExternalUrl(p.prototypeLink);
    return '<div class="panel proposal-row' + (isNew ? ' is-new' : '') + '">' +
      '<div class="proposal-head"><div><div class="muted small">Заявка от ' + H.formatDate(p.createdAt) + '</div><strong>' + H.escapeHtml(p.teamName) + '</strong></div>' +
      '<div class="proposal-badges">' + (isNew ? '<span class="new-count">Новый отклик</span>' : '') +
      '<span class="status-tag ' + statusClass + '">' + H.proposalStatusLabel(p.status) + '</span></div></div>' +
      '<p><span class="muted small">Идея:</span> ' + H.escapeHtml(p.idea) + '</p>' +
      '<p><span class="muted small">План:</span> ' + H.escapeHtml(p.plan) + '</p>' +
      '<p class="muted small">Срок: ' + H.escapeHtml(p.deadline || '—') +
        (prototypeUrl ? ' · <a href="' + H.escapeHtml(prototypeUrl) + '" target="_blank" rel="noopener noreferrer">ссылка на прототип</a>' : '') + '</p>' +
      (p.status === 'pending'
        ? '<div class="decision-box"><span class="muted small">Решение принимает представитель бизнеса</span><div class="actions">' +
          '<button class="btn btn-primary btn-sm" data-accept="' + p.id + '">Одобрить заявку</button>' +
          '<button class="btn btn-ghost btn-sm" data-decline="' + p.id + '">Отклонить</button>' +
          (isNew ? '<button class="btn btn-text btn-sm" data-seen="' + p.id + '">Отметить просмотренным</button>' : '') + '</div></div>'
        : p.status === 'accepted'
          ? '<div class="actions points-row"><label class="muted small">Баллы за фактический прогресс:</label>' +
            '<input class="input input-sm" type="number" min="0" max="100" data-points-input="' + p.id + '" value="' + (p.progressPoints == null ? '' : p.progressPoints) + '">' +
            '<button class="btn btn-ghost btn-sm" data-save-points="' + p.id + '">Сохранить баллы</button>' +
            '<button class="btn btn-text btn-sm" data-reconsider="' + p.id + '">Пересмотреть решение</button></div>'
          : '<div class="actions"><button class="btn btn-text btn-sm" data-reconsider="' + p.id + '">Пересмотреть решение</button></div>') +
    '</div>';
  }

  global.Views = global.Views || {};
  global.Views.inbox = { render: render };
})(window);
