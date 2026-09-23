const path = require('path');
const { JSDOM } = require('jsdom');

(async () => {
  const errors = [];
  const stored = new Map();
  const dom = await JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    url: 'file://' + path.join(__dirname, '..') + '/',
    beforeParse(window) {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: {
        getItem(key) { return stored.has(key) ? stored.get(key) : null; },
        setItem(key, value) { stored.set(key, String(value)); },
        removeItem(key) { stored.delete(key); }
      } });
    }
  });
  dom.window.onerror = (msg) => errors.push(String(msg));

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(300); // дать выполниться DOMContentLoaded + скриптам

  const { window } = dom;
  const doc = window.document;

  function assert(cond, label) {
    if (!cond) errors.push('ASSERT FAILED: ' + label);
    else console.log('OK:', label);
  }

  // 1. Начальный экран — бизнес по умолчанию, должен открыться мастер создания задачи.
  assert(window.State.getRole() === 'business', 'роль по умолчанию business');
  assert(doc.querySelector('#w-draft'), 'экран мастера отрисован (#w-draft найден)');
  assert(doc.querySelectorAll('[data-industry-option]').length >= 20, 'список отраслей расширен, произвольный ввод доступен');
  const weakQuestions = await window.AI.getClarifyingQuestions({ draftText: 'Нужна помощь с обработкой заявок.', industry: 'Розничная торговля' });
  const detailedQuestions = await window.AI.getClarifyingQuestions({ draftText: 'Есть CSV с данными клиентов. Нужен прототип отчёта для сотрудников отдела продаж. Срок — неделя, связь по email.', industry: 'Финтех' });
  assert(JSON.stringify(weakQuestions.questions) !== JSON.stringify(detailedQuestions.questions), 'уточняющие вопросы зависят от содержания черновика');

  // 2. Заполняем черновик и запускаем анализ (AI-заглушка, без сети).
  doc.querySelector('#w-industry').value = 'Логистика';
  doc.querySelector('#w-draft').value = 'Хотим что-то с ИИ для склада, чтобы стало удобнее работать курьерам.';
  doc.querySelector('#w-analyze').click();
  await wait(200);
  assert(doc.querySelectorAll('[data-q]').length >= 3, 'сгенерировано минимум 3 уточняющих вопроса');
  const tasksAfterFirstAnalysis = window.State.listTasks().length;
  doc.querySelector('#w-back').click();
  assert(doc.querySelector('#w-draft').value.includes('склада'), 'возврат к черновику сохраняет введённый текст');
  doc.querySelector('#w-analyze').click();
  await wait(200);
  assert(window.State.listTasks().length === tasksAfterFirstAnalysis, 'повторный анализ не создаёт дубликат задачи');
  const firstQuestions = [...doc.querySelectorAll('.question-item .field-label')].map((el) => el.textContent);
  doc.querySelector('#w-regenerate').click();
  await wait(200);
  const secondQuestions = [...doc.querySelectorAll('.question-item .field-label')].map((el) => el.textContent);
  assert(JSON.stringify(firstQuestions) !== JSON.stringify(secondQuestions), 'можно получить другие вопросы по тому же черновику');

  // 3. Отвечаем на вопросы и формируем карточку.
  doc.querySelectorAll('[data-q]').forEach((el, i) => { el.value = 'Ответ на вопрос номер ' + i + ' с достаточной длиной для теста.'; });
  doc.querySelector('#w-build').click();
  await wait(200);
  assert(doc.querySelector('[data-field="title"]'), 'экран карточки отрисован после сборки AI');

  // 4. Дополняем обязательные поля и публикуем.
  const fields = doc.querySelectorAll('[data-field]');
  assert(fields.length === 10, 'на карточке название и 9 содержательных полей');
  doc.querySelector('[data-field="title"]').value = 'Тестовая задача: распределение заказов';
  doc.querySelector('[data-field="title"]').dispatchEvent(new window.Event('input'));
  const ratingPanelBefore = doc.querySelector('#rating-panel').textContent;
  assert(/\d+\/100/.test(ratingPanelBefore), 'панель рейтинга показывает счёт X/100');
  assert(doc.querySelectorAll('.needs-attention').length > 0 && doc.querySelectorAll('[data-focus-field]').length > 0,
    'пустые поля подсвечены и есть адресные подсказки');

  doc.querySelector('#c-publish').click();
  await wait(200);
  assert(window.location.hash === '#/my-tasks', 'после публикации редирект на "Мои задачи"');
  const publishedCountBefore = window.State.listTasks({ status: 'published' }).length;
  assert(publishedCountBefore >= 6, 'опубликованная задача добавилась к пяти посевным');
  const createdTask = window.State.listTasks({ status: 'published' })[0];
  window.location.hash = '#/task/' + createdTask.id;
  await wait(150);
  assert(doc.querySelector('a[href="#/wizard/' + createdTask.id + '"]'), 'бизнес может открыть полную карточку и перейти к редактированию');
  window.location.hash = '#/wizard/' + createdTask.id;
  await wait(150);
  doc.querySelector('#c-industry').value = 'Космические сервисы';
  doc.querySelector('#c-save').click();
  await wait(150);
  assert(window.State.getTask(createdTask.id).status === 'published' && window.State.getTask(createdTask.id).industry === 'Космические сервисы',
    'сохранение опубликованной карточки не снимает публикацию и сохраняет свою отрасль');

  // 5. Переключаемся в роль студенческой команды и проверяем каталог.
  window.State.setRole('student');
  window.location.hash = '#/catalog';
  await wait(150);
  const catalogCards = doc.querySelectorAll('.catalog-card');
  assert(catalogCards.length === publishedCountBefore, 'каталог показывает все опубликованные задачи: ' + catalogCards.length);

  // 6. Открываем первую задачу каталога и откликаемся.
  const firstId = catalogCards[0].getAttribute('data-open');
  window.location.hash = '#/task/' + firstId;
  await wait(150);
  doc.querySelector('#p-idea').value = 'Идея решения для теста';
  doc.querySelector('#p-plan').value = 'План работы для теста';
  const proposalsBefore = window.State.listProposals({ taskId: firstId }).length;
  doc.querySelector('#p-submit').click();
  await wait(100);
  const proposalsAfter = window.State.listProposals({ taskId: firstId }).length;
  assert(proposalsAfter === proposalsBefore + 1, 'отклик команды добавлен (' + proposalsBefore + ' -> ' + proposalsAfter + ')');
  assert(window.State.isProposalNew(window.State.listProposals({ taskId: firstId })[0].id), 'новая заявка помечена непросмотренной');
  window.location.hash = '#/my-proposals';
  await wait(150);
  assert(doc.querySelector('.proposal-row'), 'команда видит свои поданные заявки');

  // 7. Возвращаемся в роль бизнеса и принимаем отклик через inbox.
  window.State.setRole('business');
  window.location.hash = '#/inbox/' + firstId;
  await wait(150);
  const acceptBtn = doc.querySelector('[data-accept]');
  assert(acceptBtn, 'кнопка "Принять" отображается для отклика на рассмотрении');
  assert(doc.querySelector('.proposal-row.is-new'), 'новый отклик подсвечен во входящих');
  acceptBtn.click();
  await wait(100);
  const accepted = window.State.listProposals({ taskId: firstId }).find(p => p.status === 'accepted');
  assert(!!accepted, 'отклик переведён в статус accepted вручную (без авто-назначения)');
  assert(!window.State.isProposalNew(accepted.id), 'одобренный отклик больше не отмечен новым');
  window.State.setRole('student');
  window.location.hash = '#/approved';
  await wait(150);
  assert(doc.querySelector('.proposal-row'), 'одобренные заявки доступны команде отдельным разделом');

  // 8. Рейтинг детерминирован и пересчитывается по формуле из констант.
  const recalced = window.Rating.calculate(window.State.getTask(firstId).fields);
  assert(recalced.total === window.State.getTask(firstId).rating.total, 'рейтинг задачи соответствует формуле Rating.calculate');

  console.log('\n--- JS runtime errors caught by window.onerror ---');
  console.log(errors.length ? errors : '(none)');

  const failed = errors.filter(e => e.startsWith('ASSERT') || true);
  process.exit(errors.length ? 1 : 0);
})();
