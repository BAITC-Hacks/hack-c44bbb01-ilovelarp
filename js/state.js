// Единое хранилище состояния приложения поверх localStorage.
// Ничего не рендерит — только данные и операции над ними.
(function (global) {
  'use strict';
  var STORAGE_KEY = 'hackalem_state_v1';
  var data = null;

  function uid(prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function emptyFields() {
    var fields = {};
    global.Constants.FIELDS.forEach(function (f) { fields[f.key] = ''; });
    return fields;
  }

  function defaultState() {
    return {
      role: 'business', // 'business' | 'student'
      tasks: [],
      proposals: [],
      teams: [],
      selectedTeamName: 'Команда соло-разработчика',
      seenProposalIds: [],
      aiConfig: { provider: 'stub', endpoint: 'https://api.openai.com/v1/chat/completions', apiKey: '', model: 'gpt-4o-mini' }
    };
  }

  function seedFrom(seed) {
    var state = defaultState();
    state.teams = seed.teams.slice();
    state.tasks = seed.tasks.map(function (t) {
      var fields = emptyFields();
      Object.keys(t.fields).forEach(function (k) { fields[k] = t.fields[k]; });
      var task = {
        id: t.id, status: t.status, industry: t.industry,
        fields: fields, createdAt: t.createdAt, updatedAt: t.createdAt,
        clarifyingQuestions: [], clarifyingAnswers: {}, lastAISource: null
      };
      task.rating = global.Rating.calculate(task.fields);
      return task;
    });
    state.proposals = seed.proposals.slice();
    state.seenProposalIds = seed.proposals.map(function (p) { return p.id; });
    return state;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var stored = JSON.parse(raw);
        data = Object.assign(defaultState(), stored);
        if (!Array.isArray(stored.seenProposalIds)) data.seenProposalIds = (data.proposals || []).map(function (p) { return p.id; });
        return data;
      }
    } catch (e) { console.warn('Не удалось прочитать localStorage, стартуем заново.', e); }
    data = seedFrom(global.SEED_DATA);
    save();
    return data;
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (e) { console.warn('Не удалось сохранить состояние в localStorage.', e); }
  }

  function resetDemo() {
    data = seedFrom(global.SEED_DATA);
    save();
  }

  // ---- роль ----
  function getRole() { return data.role; }
  function setRole(role) { data.role = role; save(); }

  // ---- AI-конфиг ----
  function getAIConfig() { return data.aiConfig; }
  function setAIConfig(patch) { data.aiConfig = Object.assign({}, data.aiConfig, patch); save(); }

  // ---- команды ----
  function listTeams() { return data.teams; }
  function getSelectedTeamName() { return data.selectedTeamName || 'Команда соло-разработчика'; }
  function setSelectedTeamName(name) { data.selectedTeamName = String(name || '').trim(); save(); }
  function isProposalNew(id) { return data.seenProposalIds.indexOf(id) === -1; }
  function markProposalSeen(id) {
    if (isProposalNew(id)) { data.seenProposalIds.push(id); save(); }
  }

  // ---- задачи ----
  function listTasks(filter) {
    var tasks = data.tasks;
    if (filter && filter.status) tasks = tasks.filter(function (t) { return t.status === filter.status; });
    return tasks;
  }
  function getTask(id) { return data.tasks.find(function (t) { return t.id === id; }); }

  function createTask(partial) {
    var now = new Date().toISOString();
    var task = {
      id: uid('task'), status: 'draft', industry: (partial && partial.industry) || '',
      fields: emptyFields(), createdAt: now, updatedAt: now,
      clarifyingQuestions: [], clarifyingAnswers: {}, lastAISource: null
    };
    if (partial && partial.fields) Object.assign(task.fields, partial.fields);
    task.rating = global.Rating.calculate(task.fields);
    data.tasks.unshift(task);
    save();
    return task;
  }

  function updateTask(id, patch) {
    var task = getTask(id);
    if (!task) return null;
    if (patch.fields) Object.assign(task.fields, patch.fields);
    if (patch.industry !== undefined) task.industry = patch.industry;
    if (patch.status !== undefined) task.status = patch.status;
    if (patch.clarifyingQuestions !== undefined) task.clarifyingQuestions = patch.clarifyingQuestions;
    if (patch.clarifyingAnswers !== undefined) task.clarifyingAnswers = patch.clarifyingAnswers;
    if (patch.lastAISource !== undefined) task.lastAISource = patch.lastAISource;
    task.rating = global.Rating.calculate(task.fields); // пересчёт при каждом подтверждённом изменении
    task.updatedAt = new Date().toISOString();
    save();
    return task;
  }

  function deleteTask(id) {
    data.tasks = data.tasks.filter(function (t) { return t.id !== id; });
    data.proposals = data.proposals.filter(function (p) { return p.taskId !== id; });
    save();
  }

  // ---- отклики ----
  function listProposals(filter) {
    var proposals = data.proposals;
    if (filter && filter.taskId) proposals = proposals.filter(function (p) { return p.taskId === filter.taskId; });
    return proposals;
  }

  function addProposal(proposal) {
    var p = Object.assign({
      id: uid('prop'), status: 'pending', progressPoints: null, createdAt: new Date().toISOString()
    }, proposal);
    data.proposals.unshift(p);
    save();
    return p;
  }

  function updateProposal(id, patch) {
    var p = data.proposals.find(function (x) { return x.id === id; });
    if (!p) return null;
    Object.assign(p, patch);
    save();
    return p;
  }

  global.State = {
    load: load, save: save, resetDemo: resetDemo,
    getRole: getRole, setRole: setRole,
    getAIConfig: getAIConfig, setAIConfig: setAIConfig,
    listTeams: listTeams,
    getSelectedTeamName: getSelectedTeamName, setSelectedTeamName: setSelectedTeamName,
    isProposalNew: isProposalNew, markProposalSeen: markProposalSeen,
    listTasks: listTasks, getTask: getTask, createTask: createTask, updateTask: updateTask, deleteTask: deleteTask,
    listProposals: listProposals, addProposal: addProposal, updateProposal: updateProposal,
    uid: uid, emptyFields: emptyFields
  };
})(window);
