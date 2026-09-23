(function (global) {
  'use strict';

  function renderRoleSwitch() {
    var role = global.State.getRole();
    var el = document.getElementById('role-switch');
    el.innerHTML =
      '<div class="sidebar-caption">РАБОЧЕЕ ПРОСТРАНСТВО</div>' +
      '<button class="role-btn role-business' + (role === 'business' ? ' is-active' : '') + '" data-role="business"><span class="role-icon">↗</span><span><strong>Бизнес</strong><small>Создать задачу и выбрать команду</small></span></button>' +
      '<button class="role-btn role-student' + (role === 'student' ? ' is-active' : '') + '" data-role="student"><span class="role-icon">✦</span><span><strong>Студенческая команда</strong><small>Найти задачу и подать заявку</small></span></button>' +
      (role === 'student' ? '<div class="team-selector"><label class="field-label" for="active-team">Текущая команда</label>' +
        '<select id="active-team" class="input">' + global.State.listTeams().map(function (team) {
          return '<option value="' + global.Helpers.escapeHtml(team.name) + '"' + (team.name === global.State.getSelectedTeamName() ? ' selected' : '') + '>' + global.Helpers.escapeHtml(team.name) + '</option>';
        }).join('') + '</select></div>' : '');
    el.querySelectorAll('[data-role]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        global.State.setRole(btn.getAttribute('data-role'));
        renderRoleSwitch();
        global.Router.navigate(btn.getAttribute('data-role') === 'business' ? '/wizard' : '/catalog');
      });
    });
    var teamSelect = el.querySelector('#active-team');
    if (teamSelect) teamSelect.addEventListener('change', function () {
      global.State.setSelectedTeamName(teamSelect.value);
      global.Router.refresh();
    });
  }

  function renderSettings() {
    var modal = document.getElementById('settings-modal');
    var cfg = global.State.getAIConfig();
    modal.innerHTML =
      '<div class="modal-box">' +
        '<h2>Настройки AI</h2>' +
        '<p class="muted small">По умолчанию используется офлайн-заглушка — она не требует ключей и интернета. ' +
          'Чтобы подключить реальную модель, укажите OpenAI-совместимый endpoint и ключ.</p>' +
        '<label class="field-label">Источник</label>' +
        '<select id="s-provider" class="input">' +
          '<option value="stub"' + (cfg.provider === 'stub' ? ' selected' : '') + '>Локальная заглушка (офлайн)</option>' +
          '<option value="external"' + (cfg.provider === 'external' ? ' selected' : '') + '>Внешний API</option>' +
        '</select>' +
        '<label class="field-label">Endpoint</label><input id="s-endpoint" class="input" value="' + global.Helpers.escapeHtml(cfg.endpoint) + '">' +
        '<label class="field-label">Модель</label><input id="s-model" class="input" value="' + global.Helpers.escapeHtml(cfg.model) + '">' +
        '<label class="field-label">API-ключ (хранится только в этом браузере)</label>' +
        '<input id="s-key" class="input" type="password" value="' + global.Helpers.escapeHtml(cfg.apiKey) + '">' +
        '<div class="actions">' +
          '<button id="s-reset" class="btn btn-ghost">Сбросить демо-данные</button>' +
          '<button id="s-save" class="btn btn-primary">Сохранить</button>' +
        '</div>' +
      '</div>';
    modal.querySelector('#s-save').addEventListener('click', function () {
      global.State.setAIConfig({
        provider: modal.querySelector('#s-provider').value,
        endpoint: modal.querySelector('#s-endpoint').value.trim(),
        model: modal.querySelector('#s-model').value.trim(),
        apiKey: modal.querySelector('#s-key').value.trim()
      });
      modal.classList.remove('is-open');
    });
    modal.querySelector('#s-reset').addEventListener('click', function () {
      if (confirm('Сбросить все данные и вернуть демо-набор? Действие необратимо.')) {
        global.State.resetDemo();
        global.location.hash = '#/';
        modal.classList.remove('is-open');
        renderRoleSwitch();
        global.Router.refresh();
      }
    });
  }

  function init() {
    global.State.load();
    renderRoleSwitch();
    renderSettings();

    document.getElementById('settings-btn').addEventListener('click', function () {
      document.getElementById('settings-modal').classList.add('is-open');
    });
    document.getElementById('settings-modal').addEventListener('click', function (e) {
      if (e.target.id === 'settings-modal') e.target.classList.remove('is-open');
    });

    global.Router.register('/wizard', global.Views.wizard);
    global.Router.register('/wizard/:id', global.Views.wizard);
    global.Router.register('/my-tasks', global.Views.myTasks);
    global.Router.register('/inbox', global.Views.inbox);
    global.Router.register('/inbox/:taskId', global.Views.inbox);
    global.Router.register('/catalog', global.Views.catalog);
    global.Router.register('/task/:id', global.Views.taskDetail);
    global.Router.register('/my-proposals', global.Views.myProposals);
    global.Router.register('/approved', global.Views.myProposals);

    global.Router.init(document.getElementById('main'));
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
