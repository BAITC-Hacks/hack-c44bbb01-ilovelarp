// Единственная содержательная AI-функция кейса (п.5): анализ полноты черновика + уточняющие
// вопросы, и преобразование ответов в карточку задачи. ИИ никогда не придумывает факты —
// он только структурирует то, что ввёл пользователь. Есть два источника:
//   'external' — реальный вызов LLM (OpenAI-совместимый Chat Completions API);
//   'stub'     — офлайн-заглушка на ключевых словах (работает без интернета и ключей).
// Промпты храним как обычные строки — их же показываем в интерфейсе (панель "Как работает AI").
(function (global) {
  'use strict';
  var C = global.Constants;

  function keywordScore(text, keywords) {
    var t = (text || '').toLowerCase();
    var hits = keywords.filter(function (kw) { return t.indexOf(kw) !== -1; }).length;
    return Math.min(1, hits / 2) + (t.length > 40 ? 0.15 : 0);
  }

  var CATEGORY_KEYWORDS = {
    context_need: ['проблем', 'сейчас', 'нужно', 'нужна', 'задача', 'ситуаци'],
    data_materials: ['данны', 'файл', 'csv', 'excel', 'пример', 'источник', 'база', 'выгрузк'],
    expected_result: ['результат', 'получить', 'отчет', 'отчёт', 'прототип', 'дашборд', 'сделать'],
    success_criteria: ['критер', 'успех', 'метрик', 'оцен', 'показател'],
    constraints: ['срок', 'бюджет', 'технолог', 'стек', 'доступ', 'ограничен'],
    users: ['пользовател', 'клиент', 'сотрудник', 'команда', 'отдел'],
    business_contact: ['контакт', 'связь', 'email', 'почт', 'телефон', 'звонок', 'чат']
  };

  function buildAnalyzePrompt(input) {
    var system = 'Ты помогаешь представителю бизнеса дополнить описание задачи для студенческого хакатона. ' +
      'На основе черновика определи, какие из 7 категорий недостаточно раскрыты, и задай не менее 3 уместных, ' +
      'конкретных уточняющих вопросов (каждый привязан к одной категории). ' +
      'Не спрашивай повторно о сведениях, которые уже явно есть в черновике. Сначала уточняй самые важные пробелы. ' +
      'НИКОГДА не придумывай факты, которых нет в черновике. Ответь строго JSON без пояснений, формат: ' +
      '{"missing": ["context_need", "..."], "questions": [{"category": "context_need", "text": "..."}]}. ' +
      'Допустимые category: ' + C.CATEGORY_ORDER.join(', ') + '.';
    var user = 'Отрасль: ' + (input.industry || 'не указана') + '\nЧерновик задачи:\n' + input.draftText;
    return { system: system, user: user };
  }

  function buildCardPrompt(input) {
    var system = 'Ты преобразуешь черновик задачи и ответы на уточняющие вопросы в структурированную карточку. ' +
      'Используй ТОЛЬКО факты, явно сообщённые пользователем в черновике и ответах — ничего не добавляй от себя. ' +
      'Если для какого-то поля данных недостаточно — верни пустую строку для него, не выдумывай. ' +
      'Ответь строго JSON без пояснений: {"title": "...", "context": "...", "need": "...", "users": "...", ' +
      '"data": "...", "constraints": "...", "expectedResult": "...", "successCriteria": "...", "contact": "...", ' +
      '"interactionFormat": "..."}.';
    var qa = input.answers.map(function (a) { return '- (' + a.category + ') ' + a.question + ' -> ' + (a.answer || '(без ответа)'); }).join('\n');
    var user = 'Отрасль: ' + (input.industry || 'не указана') + '\nЧерновик:\n' + input.draftText + '\n\nОтветы на уточняющие вопросы:\n' + qa;
    return { system: system, user: user };
  }

  function safeParseJSON(text) {
    if (!text) return null;
    var cleaned = String(text).trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    try { return JSON.parse(cleaned); } catch (e) { return null; }
  }

  // Транспорт: OpenAI-совместимый Chat Completions API. Чтобы использовать другого провайдера
  // (например, Anthropic /v1/messages), замените тело этой функции — остальной код не меняется.
  function callChatCompletion(config, prompt) {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 20000);
    return fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + config.apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
        temperature: 0.2
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (json) {
      var content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
      if (!content) throw new Error('Пустой ответ модели');
      return content;
    }).finally(function () { clearTimeout(timeout); });
  }

  // ---- заглушка: анализ ----
  function stubAnalyze(input, alreadyAsked) {
    var draft = (input.draftText || '').trim();
    var scored = C.CATEGORY_ORDER.map(function (cat) {
      return { cat: cat, score: keywordScore(draft, CATEGORY_KEYWORDS[cat]) };
    });
    var priority = ['context_need', 'data_materials', 'expected_result', 'success_criteria',
      'users', 'business_contact', 'constraints'];
    scored.sort(function (a, b) { return a.score - b.score || priority.indexOf(a.cat) - priority.indexOf(b.cat); });
    var missing = scored.filter(function (s) { return s.score < 0.65; }).map(function (s) { return s.cat; });
    if (missing.length < 3) {
      scored.forEach(function (s) { if (missing.length < 3 && missing.indexOf(s.cat) === -1) missing.push(s.cat); });
    }
    var picked = missing.slice(0, 6);
    ['users', 'business_contact'].forEach(function (essential) {
      if (missing.indexOf(essential) !== -1 && picked.indexOf(essential) === -1) {
        var replaceIndex = picked.length - 1;
        while (replaceIndex > 0 && ['users', 'business_contact'].indexOf(picked[replaceIndex]) !== -1) replaceIndex--;
        picked[replaceIndex] = essential;
      }
    });
    var questions = picked.map(function (cat) {
      var bank = C.QUESTION_BANK[cat];
      var seed = (draft + '|' + (input.industry || '') + '|' + cat).split('').reduce(function (n, char) {
        return (n * 31 + char.charCodeAt(0)) >>> 0;
      }, 7);
      var q = bank.map(function (_, index) { return bank[(seed + index) % bank.length]; })
        .find(function (text) { return (alreadyAsked || []).indexOf(text) === -1; }) || bank[seed % bank.length];
      return { category: cat, text: q };
    });
    return { missing: missing, questions: questions };
  }

  // ---- заглушка: сборка карточки (только перераспределяет введённый пользователем текст) ----
  function stubBuildCard(input) {
    var card = { title: '', context: '', need: '', users: '', data: '', constraints: '',
      expectedResult: '', successCriteria: '', contact: '', interactionFormat: '' };
    card.title = input.draftText.trim().slice(0, 70) + (input.draftText.length > 70 ? '…' : '');
    card.context = input.draftText.trim();
    var byCategory = { context_need: [], data_materials: [], expected_result: [], success_criteria: [],
      constraints: [], users: [], business_contact: [] };
    input.answers.forEach(function (a) {
      if (a.answer && a.answer.trim() && byCategory[a.category]) byCategory[a.category].push(a);
    });
    byCategory.context_need.forEach(function (a) {
      if (/сейчас|проблем|проявля|работает/i.test(a.question)) card.context += ' ' + a.answer.trim();
      else card.need += (card.need ? ' ' : '') + a.answer.trim();
    });
    if (byCategory.data_materials.length) card.data = byCategory.data_materials.map(function (a) { return a.answer.trim(); }).join(' ');
    if (byCategory.expected_result.length) card.expectedResult = byCategory.expected_result.map(function (a) { return a.answer.trim(); }).join(' ');
    if (byCategory.success_criteria.length) card.successCriteria = byCategory.success_criteria.map(function (a) { return a.answer.trim(); }).join(' ');
    if (byCategory.constraints.length) card.constraints = byCategory.constraints.map(function (a) { return a.answer.trim(); }).join(' ');
    if (byCategory.users.length) card.users = byCategory.users.map(function (a) { return a.answer.trim(); }).join(' ');
    byCategory.business_contact.forEach(function (a) {
      var key = /формат|обсужд|созвон|часто|где/i.test(a.question) ? 'interactionFormat' : 'contact';
      card[key] += (card[key] ? ' ' : '') + a.answer.trim();
    });
    return card;
  }

  // ---- публичное API ----
  function getClarifyingQuestions(input, alreadyAsked) {
    var config = global.State.getAIConfig();
    var prompt = buildAnalyzePrompt(input);
    if (config.provider === 'external' && config.apiKey) {
      return callChatCompletion(config, prompt).then(function (raw) {
        var parsed = safeParseJSON(raw);
        if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length < 3 ||
            !parsed.questions.every(function (q) {
              return q && C.CATEGORY_ORDER.indexOf(q.category) !== -1 && typeof q.text === 'string' && q.text.trim();
            })) {
          throw new Error('Ответ модели не похож на ожидаемый JSON с questions[] (мин. 3)');
        }
        return { source: 'ai', prompt: prompt, raw: raw, missing: Array.isArray(parsed.missing) ? parsed.missing : [], questions: parsed.questions.slice(0, 7) };
      }).catch(function (err) {
        console.warn('AI недоступен, использую локальную заглушку:', err.message);
        var stub = stubAnalyze(input, alreadyAsked);
        return { source: 'stub', prompt: prompt, error: err.message, missing: stub.missing, questions: stub.questions };
      });
    }
    var stub = stubAnalyze(input, alreadyAsked);
    return Promise.resolve({ source: 'stub', prompt: prompt, missing: stub.missing, questions: stub.questions });
  }

  function buildCard(input) {
    var config = global.State.getAIConfig();
    var prompt = buildCardPrompt(input);
    if (config.provider === 'external' && config.apiKey) {
      return callChatCompletion(config, prompt).then(function (raw) {
        var parsed = safeParseJSON(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
            !C.FIELDS.every(function (f) { return parsed[f.key] === undefined || typeof parsed[f.key] === 'string'; })) {
          throw new Error('Ответ модели не похож на ожидаемый JSON карточки');
        }
        var card = {};
        C.FIELDS.forEach(function (f) { card[f.key] = parsed[f.key] || ''; });
        return { source: 'ai', prompt: prompt, raw: raw, card: card };
      }).catch(function (err) {
        console.warn('AI недоступен, использую локальную заглушку:', err.message);
        return { source: 'stub', prompt: prompt, error: err.message, card: stubBuildCard(input) };
      });
    }
    return Promise.resolve({ source: 'stub', prompt: prompt, card: stubBuildCard(input) });
  }

  global.AI = { getClarifyingQuestions: getClarifyingQuestions, buildCard: buildCard,
    buildAnalyzePrompt: buildAnalyzePrompt, buildCardPrompt: buildCardPrompt };
})(window);
