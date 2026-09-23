// Мастер создания/редактирования бизнес-задачи. Шаги 1-4 сквозного сценария кейса:
// черновик -> уточняющие вопросы -> редактируемая карточка -> рейтинг.
(function (global) {
  'use strict';
  var C = global.Constants;
  var H = global.Helpers;

  function industryControlHtml(id, value) {
    return '<div class="industry-control"><input id="' + id + '" class="input" type="text" autocomplete="off" ' +
      'placeholder="Напишите свою отрасль" value="' + H.escapeHtml(value || '') + '">' +
      '<button type="button" class="btn btn-ghost industry-toggle" aria-label="Показать варианты отраслей" aria-expanded="false">Выбрать ↓</button>' +
      '<div class="industry-menu" hidden>' + C.INDUSTRIES.map(function (name) {
        return '<button type="button" data-industry-option="' + H.escapeHtml(name) + '">' + H.escapeHtml(name) + '</button>';
      }).join('') + '</div></div>';
  }

  function bindIndustryControl(container, id) {
    var input = container.querySelector('#' + id);
    var control = input.parentElement;
    var menu = control.querySelector('.industry-menu');
    var toggle = control.querySelector('.industry-toggle');
    toggle.addEventListener('click', function () {
      menu.hidden = !menu.hidden;
      toggle.setAttribute('aria-expanded', String(!menu.hidden));
    });
    control.querySelectorAll('[data-industry-option]').forEach(function (option) {
      option.addEventListener('click', function () {
        input.value = option.getAttribute('data-industry-option');
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
  }

  function render(container, params) {
    var existingTask = params.id ? global.State.getTask(params.id) : null;
    var stage = existingTask ? 'card' : 'draft';
    var workingTask = existingTask || null; // появится после стадии "черновик"

    function paint() {
      if (stage === 'draft') paintDraft();
      else if (stage === 'clarify') paintClarify();
      else paintCard();
    }

    // ---------- Стадия 1: черновик ----------
    function paintDraft() {
      var examples = global.SEED_DATA.exampleDrafts;
      var aiConfig = global.State.getAIConfig();
      var externalReady = aiConfig.provider === 'external' && !!aiConfig.apiKey;
      container.innerHTML =
        '<div class="stage-header"><div class="eyebrow">БИЗНЕС · ШАГ 01 / 03</div><h1>Опишите задачу своими словами</h1><p class="muted">Достаточно нескольких предложений. Система найдёт пробелы и поможет оформить карточку.</p></div>' +
        '<div class="panel">' +
          '<label class="field-label">Отрасль</label>' +
          industryControlHtml('w-industry', workingTask ? workingTask.industry : '') +
          '<label class="field-label" style="margin-top:16px">Черновик описания</label>' +
          '<textarea id="w-draft" class="input textarea-lg" placeholder="Опишите задачу свободно, в паре предложений — систему потом дополнит вопросами">' + H.escapeHtml(workingTask ? workingTask.fields.context : '') + '</textarea>' +
          '<div class="source-note"><span class="source-dot ' + (externalReady ? 'is-online' : '') + '"></span><span>' +
          (externalReady ? 'Вопросы сформирует подключённая модель.' : 'Сейчас работает локальный анализ черновика. Для вопросов от модели подключите AI.') +
          '</span><button type="button" id="w-ai-settings" class="btn btn-text btn-sm">Настроить AI</button></div>' +
          '<div class="example-heading"><strong>Посмотрите пример</strong><span class="muted small">Выберите уровень детализации, затем вставьте текст в черновик.</span></div>' +
          '<div class="examples">' +
            examples.map(function (ex, i) {
              return '<button type="button" class="chip" data-example="' + i + '">' + H.escapeHtml(ex.title) + '</button>';
            }).join('') +
          '</div>' +
          '<div id="example-preview" class="example-preview" hidden></div>' +
          '<div class="actions"><button id="w-analyze" class="btn btn-primary">Проанализировать →</button></div>' +
        '</div>';

      bindIndustryControl(container, 'w-industry');
      container.querySelector('#w-ai-settings').addEventListener('click', function () {
        document.getElementById('settings-btn').click();
      });

      container.querySelectorAll('[data-example]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var ex = examples[Number(btn.getAttribute('data-example'))];
          container.querySelectorAll('[data-example]').forEach(function (item) { item.classList.remove('is-active'); });
          btn.classList.add('is-active');
          var preview = container.querySelector('#example-preview');
          preview.hidden = false;
          preview.innerHTML = '<div class="muted small">' + H.escapeHtml(ex.industry) + ' · учебный пример</div>' +
            '<p>' + H.escapeHtml(ex.text) + '</p><button type="button" id="use-example" class="btn btn-ghost btn-sm">Использовать этот пример</button>';
          preview.querySelector('#use-example').addEventListener('click', function () {
            container.querySelector('#w-draft').value = ex.text;
            container.querySelector('#w-industry').value = ex.industry;
            container.querySelector('#w-draft').focus();
          });
        });
      });

      container.querySelector('#w-analyze').addEventListener('click', function () {
        var text = container.querySelector('#w-draft').value.trim();
        var industry = container.querySelector('#w-industry').value;
        if (!text) { container.querySelector('#w-draft').focus(); return; }
        var btn = container.querySelector('#w-analyze');
        btn.disabled = true; btn.textContent = 'Анализирую…';
        global.AI.getClarifyingQuestions({ draftText: text, industry: industry }).then(function (result) {
          workingTask = workingTask
            ? global.State.updateTask(workingTask.id, { industry: industry, fields: { context: text } })
            : global.State.createTask({ industry: industry, fields: { context: text } });
          global.State.updateTask(workingTask.id, {
            clarifyingQuestions: result.questions, clarifyingAnswers: {}, lastAISource: result.source
          });
          workingTask = global.State.getTask(workingTask.id);
          workingTask._lastPrompt = result.prompt; workingTask._lastError = result.error;
          stage = 'clarify';
          paint();
        }).catch(function () {
          btn.disabled = false; btn.textContent = 'Проанализировать →';
          alert('Не удалось проанализировать черновик. Попробуйте ещё раз.');
        });
      });
    }

    // ---------- Стадия 2: уточняющие вопросы ----------
    function paintClarify() {
      var questions = workingTask.clarifyingQuestions || [];
      container.innerHTML =
        '<div class="stage-header"><div class="eyebrow">БИЗНЕС · ШАГ 02 / 03</div><h1>Уточняющие вопросы</h1><p class="muted">Вопросы выбраны по пробелам в вашем черновике. Отвечайте только на то, что известно.</p></div>' +
        aiSourceBadge(workingTask) +
        '<div class="panel">' +
          questions.map(function (q, i) {
            return '<div class="question-item"><div class="question-number">0' + (i + 1) + '</div><div>' +
              '<label class="field-label" for="question-' + i + '">' + H.escapeHtml(q.text) + '</label>' +
              '<div class="muted small">Раздел: ' + H.escapeHtml(C.CATEGORY_META[q.category] ? C.CATEGORY_META[q.category].label : 'Дополнительные сведения') + '</div>' +
              '<textarea id="question-' + i + '" class="input" data-q="' + i + '" placeholder="Ваш ответ"></textarea></div></div>';
          }).join('') +
          '<div class="actions">' +
            '<button id="w-back" class="btn btn-text">← Изменить черновик</button>' +
            '<button id="w-regenerate" class="btn btn-ghost">Другие вопросы</button>' +
            '<button id="w-skip" class="btn btn-ghost">Пропустить →</button>' +
            '<button id="w-build" class="btn btn-primary">Сформировать карточку →</button>' +
          '</div>' +
        '</div>';

      function collectAnswers() {
        return questions.map(function (q, i) {
          var val = container.querySelector('[data-q="' + i + '"]').value.trim();
          return { category: q.category, question: q.text, answer: val };
        });
      }

      function proceed(answers) {
        var answerMap = {};
        answers.forEach(function (a) { answerMap[a.question] = a.answer; });
        var btn = container.querySelector('#w-build');
        if (btn) { btn.disabled = true; btn.textContent = 'Собираю карточку…'; }
        global.AI.buildCard({
          draftText: workingTask.fields.context, industry: workingTask.industry, answers: answers
        }).then(function (result) {
          var card = result.card;
          var patchFields = {};
          C.FIELDS.forEach(function (f) {
            if (!workingTask.fields[f.key] && card[f.key]) patchFields[f.key] = card[f.key];
          });
          global.State.updateTask(workingTask.id, {
            fields: patchFields, clarifyingAnswers: answerMap, lastAISource: result.source
          });
          workingTask = global.State.getTask(workingTask.id);
          workingTask._lastPrompt = result.prompt; workingTask._lastError = result.error;
          stage = 'card';
          paint();
        });
      }

      container.querySelector('#w-build').addEventListener('click', function () { proceed(collectAnswers()); });
      container.querySelector('#w-skip').addEventListener('click', function () { proceed([]); });
      container.querySelector('#w-back').addEventListener('click', function () { stage = 'draft'; paintDraft(); });
      container.querySelector('#w-regenerate').addEventListener('click', function () {
        if (collectAnswers().some(function (a) { return a.answer; }) && !confirm('Текущие ответы будут удалены. Показать другие вопросы?')) return;
        var previous = questions.map(function (q) { return q.text; });
        global.AI.getClarifyingQuestions({ draftText: workingTask.fields.context, industry: workingTask.industry }, previous)
          .then(function (result) {
            global.State.updateTask(workingTask.id, { clarifyingQuestions: result.questions, lastAISource: result.source });
            workingTask = global.State.getTask(workingTask.id);
            paintClarify();
          });
      });
    }

    // ---------- Стадия 3: редактируемая карточка + рейтинг ----------
    function paintCard() {
      var task = workingTask;
      var isPublished = task.status === 'published';
      container.innerHTML =
        '<div class="stage-header"><div class="eyebrow">БИЗНЕС · ШАГ 03 / 03</div><h1>' + (isPublished ? 'Редактирование задачи' : 'Карточка задачи') + '</h1>' +
        '<p class="muted">' + (isPublished ? 'Изменения пересчитывают рейтинг сразу после сохранения.' : 'Шаг 3 из 3 — проверьте и дополните карточку перед публикацией.') + '</p></div>' +
        '<div class="card-layout">' +
          '<div class="panel card-form">' +
            C.FIELDS.map(function (f) { return fieldHtml(f, task.fields[f.key]); }).join('') +
            '<label class="field-label">Отрасль</label>' +
            industryControlHtml('c-industry', task.industry) +
            '<div class="actions">' +
              '<button id="c-save" class="btn btn-ghost">' + (isPublished ? 'Сохранить без смены статуса' : 'Сохранить черновик') + '</button>' +
              '<button id="c-publish" class="btn btn-primary">' + (isPublished ? 'Сохранить изменения' : 'Подтвердить и опубликовать в каталог') + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="panel card-rating"><div id="rating-panel"></div><div id="field-suggestions"></div></div>' +
        '</div>' +
        aiPromptPanel(task);

      bindIndustryControl(container, 'c-industry');

      function currentFields() {
        var fields = {};
        C.FIELDS.forEach(function (f) { fields[f.key] = container.querySelector('[data-field="' + f.key + '"]').value; });
        return fields;
      }

      function paintRating() {
        var fields = currentFields();
        var live = global.Rating.calculate(fields);
        container.querySelector('#rating-panel').innerHTML =
          '<h3>Рейтинг</h3>' + H.levelBadgeHtml(live.level, live.total) +
          '<p class="muted small" style="margin-top:6px">' + live.level.hint + '</p>' +
          H.ratingBreakdownHtml(live);
        var prompts = {
          title: 'Назовите проблему так, чтобы команда сразу поняла задачу.',
          context: 'Опишите текущий процесс и где возникает трудность.',
          need: 'Уточните, что именно нужно изменить в этом процессе.',
          users: 'Назовите людей или отдел, которые будут проверять решение.',
          data: 'Перечислите доступные файлы, примеры и условия доступа к ним.',
          constraints: 'Укажите сроки, стек, правила доступа или напишите, что ограничений нет.',
          expectedResult: 'Опишите конкретный результат: прототип, отчёт, API или другой артефакт.',
          successCriteria: 'Добавьте измеримый признак, по которому примете результат.',
          contact: 'Оставьте имя и рабочий способ связи для вопросов команды.',
          interactionFormat: 'Укажите, как часто и где удобно обсуждать ход работы.'
        };
        if (/csv|excel|таблиц|данн|выгрузк/i.test(fields.context || '') && !fields.data.trim()) {
          prompts.data = 'В контексте упомянуты материалы. Уточните их формат и как команда получит доступ.';
        }
        if (fields.expectedResult.trim() && !fields.successCriteria.trim()) {
          prompts.successCriteria = 'Результат уже описан. Как вы проверите его качество на демонстрации?';
        }
        if (fields.contact.trim() && !fields.interactionFormat.trim()) {
          prompts.interactionFormat = 'Контакт есть. Укажите удобный канал и частоту ответов команде.';
        }
        var recommendations = C.FIELDS.map(function (f) {
          return { field: f, ratio: global.Rating.fieldRatio(fields[f.key]) };
        }).filter(function (item) { return item.ratio < 1; }).sort(function (a, b) { return a.ratio - b.ratio; }).slice(0, 5);
        container.querySelector('#field-suggestions').innerHTML =
          '<h3>Что дополнить</h3>' +
          (recommendations.length ? '<div class="suggestion-list">' + recommendations.map(function (item) {
            var gap = live.missing.find(function (m) { return m.key === item.field.category; });
            return '<button type="button" class="suggestion" data-focus-field="' + item.field.key + '"><strong>' +
              H.escapeHtml(item.field.label) + '</strong><span>' + H.escapeHtml(prompts[item.field.key]) + '</span>' +
              (gap ? '<em>До +' + gap.missingPoints + ' баллов в разделе</em>' : '') + '</button>';
          }).join('') + '</div>' : '<p class="tip-done">Карточка подробно заполнена.</p>');
        container.querySelectorAll('[data-field]').forEach(function (el) {
          var ratio = global.Rating.fieldRatio(el.value);
          el.classList.toggle('needs-attention', ratio === 0);
          el.classList.toggle('needs-detail', ratio > 0 && ratio < 1);
        });
        container.querySelectorAll('[data-focus-field]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var field = container.querySelector('[data-field="' + btn.getAttribute('data-focus-field') + '"]');
            field.scrollIntoView({ behavior: 'smooth', block: 'center' });
            field.focus();
          });
        });
      }
      paintRating();
      container.querySelectorAll('[data-field]').forEach(function (el) { el.addEventListener('input', paintRating); });

      function persist(newStatus) {
        var fields = currentFields();
        var industry = container.querySelector('#c-industry').value;
        if (!fields.title.trim()) { container.querySelector('[data-field="title"]').focus(); return; }
        global.State.updateTask(task.id, { fields: fields, industry: industry.trim(), status: newStatus });
        workingTask = global.State.getTask(task.id);
        global.Router.navigate('/my-tasks');
      }
      container.querySelector('#c-save').addEventListener('click', function () { persist(task.status); });
      container.querySelector('#c-publish').addEventListener('click', function () { persist('published'); });
    }

    function fieldHtml(f, value) {
      var input = f.type === 'textarea'
        ? '<textarea class="input" data-field="' + f.key + '" placeholder="' + H.escapeHtml(f.placeholder) + '">' + H.escapeHtml(value) + '</textarea>'
        : '<input class="input" type="text" data-field="' + f.key + '" placeholder="' + H.escapeHtml(f.placeholder) + '" value="' + H.escapeHtml(value) + '">';
      return '<label class="field-label">' + f.label + '</label>' + input;
    }

    function aiSourceBadge(task) {
      var src = task.lastAISource === 'ai' ? 'внешняя модель' : 'локальная заглушка (офлайн)';
      return '<p class="muted small">Источник вопросов: ' + src + (task._lastError ? ' — AI недоступен: ' + H.escapeHtml(task._lastError) : '') + '</p>';
    }

    function aiPromptPanel(task) {
      if (!task._lastPrompt) return '';
      return '<details class="panel prompt-panel"><summary>Как это считает AI (промпт и формат ответа)</summary>' +
        '<p class="muted small">Источник последнего вызова: ' + (task.lastAISource === 'ai' ? 'внешняя модель' : 'локальная заглушка') + '</p>' +
        '<pre class="prompt-block">' + H.escapeHtml(task._lastPrompt.system) + '\n\n---\n' + H.escapeHtml(task._lastPrompt.user) + '</pre>' +
        '</details>';
    }

    paint();
  }

  global.Views = global.Views || {};
  global.Views.wizard = { render: render };
})(window);
