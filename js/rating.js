// Формула рейтинга задачи. Баллы начисляются только за заполненные поля (п.4 кейса).
(function (global) {
  'use strict';
  var C = global.Constants;

  // Полнота одного текстового поля: 0 / 0.35 / 0.7 / 1.0 в зависимости от длины ответа.
  // Так рост рейтинга виден постепенно по мере дозаполнения карточки — удобно для демо.
  function fieldRatio(text) {
    var t = (text || '').trim();
    if (!t) return 0;
    if (t.length < 20) return 0.35;
    if (t.length < 60) return 0.7;
    return 1;
  }

  function fieldsByCategory(category) {
    return C.FIELDS.filter(function (f) { return f.category === category; }).map(function (f) { return f.key; });
  }

  // Считает рейтинг по объекту fields ({context, need, data, ...}).
  // Возвращает { total, level, breakdown: [{key,label,weight,score,ratio}], missing: [label,...] }
  function calculate(fields) {
    fields = fields || {};
    var breakdown = [];
    var total = 0;
    var missing = [];

    C.CATEGORY_ORDER.forEach(function (catKey) {
      var meta = C.CATEGORY_META[catKey];
      var keys = fieldsByCategory(catKey);
      var ratios = keys.map(function (k) { return fieldRatio(fields[k]); });
      var avgRatio = ratios.reduce(function (a, b) { return a + b; }, 0) / ratios.length;
      var score = Math.round(meta.weight * avgRatio);
      total += score;
      breakdown.push({ key: catKey, label: meta.label, weight: meta.weight, score: score, ratio: avgRatio });
      if (avgRatio < 1) missing.push({ key: catKey, label: meta.label, missingPoints: meta.weight - score });
    });

    total = Math.min(100, total);
    var level = C.LEVELS.find(function (l) { return total >= l.min && total <= l.max; }) || C.LEVELS[0];

    // Подсказки — сортируем недостающее по количеству недополученных баллов (что улучшить в первую очередь).
    missing.sort(function (a, b) { return b.missingPoints - a.missingPoints; });

    return { total: total, level: level, breakdown: breakdown, missing: missing };
  }

  global.Rating = { calculate: calculate, fieldRatio: fieldRatio };
})(window);
