(function (global) {
  'use strict';

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function levelBadgeHtml(level, score) {
    return '<span class="badge badge-' + level.key + '">' + level.label + ' · ' + score + '/100</span>';
  }

  function ratingBreakdownHtml(rating) {
    return '<div class="rating-breakdown">' + rating.breakdown.map(function (b) {
      var pct = Math.round((b.score / b.weight) * 100);
      return '<div class="rb-row"><div class="rb-label">' + escapeHtml(b.label) + '</div>' +
        '<div class="rb-bar"><div class="rb-bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="rb-score">' + b.score + '/' + b.weight + '</div></div>';
    }).join('') + '</div>';
  }

  function ratingTipsHtml(rating) {
    if (!rating.missing.length) return '<p class="tip tip-done">Все категории заполнены полностью.</p>';
    return '<ul class="tips">' + rating.missing.slice(0, 3).map(function (m) {
      return '<li>Дополните раздел «' + escapeHtml(m.label) + '» — сейчас теряется до ' + m.missingPoints + ' баллов.</li>';
    }).join('') + '</ul>';
  }

  function proposalStatusLabel(status) {
    return status === 'accepted' ? 'Принята' : status === 'declined' ? 'Отклонена' : 'На рассмотрении';
  }

  function safeExternalUrl(url) {
    try {
      var parsed = new URL(String(url || ''));
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (e) { return ''; }
  }

  global.Helpers = {
    escapeHtml: escapeHtml, formatDate: formatDate, levelBadgeHtml: levelBadgeHtml,
    ratingBreakdownHtml: ratingBreakdownHtml, ratingTipsHtml: ratingTipsHtml,
    proposalStatusLabel: proposalStatusLabel, safeExternalUrl: safeExternalUrl
  };
})(window);
