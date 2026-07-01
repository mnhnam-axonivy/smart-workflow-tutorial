(function() {

  // ── Language state ──────────────────────────────────────────────────────────
  var currentLang = localStorage.getItem('sw-lang') || 'en';
  var currentFeatureId = null;

  // ── Feature cross-reference maps ────────────────────────────────────────────
  var FEATURE_LINK_MAP = {
    'Basic Agent Setup': '01',
    'Structured Output': '02',
    'Model Provider Selection': '03',
    'File Extraction': '04',
    'Callable Process Tools': '05',
    'Java Tools': '06',
    'Java Tools (SPI pattern)': '06',
    'Web Search Tool': '07',
    'Observability': '08',
    'Output Guardrail': '09',
    'Input Guardrail': '10',
  };

  var FEATURE_LINK_MAP_JP = {
    'エージェントの基本設定': '01',
    '構造化出力': '02',
    'モデルプロバイダーの選択': '03',
    'ファイル抽出': '04',
    '呼び出し可能プロセスツール': '05',
    'Javaツール': '06',
    'ウェブ検索ツール': '07',
    '観測可能性': '08',
    '出力ガードレール': '09',
    '入力ガードレール': '10',
  };

  // ── UI strings ──────────────────────────────────────────────────────────────
  var UI_STRINGS = {
    en: { back: '← All Features', onThisPage: 'On this page' },
    jp: { back: '← 一覧に戻る',   onThisPage: '目次' }
  };

  // JP translations for server-rendered index page elements.
  // Keys under 'features' are the showFeature IDs used in onclick attributes.
  var JP_UI = {
    hero: {
      title: 'Smart Workflow 機能ガイド',
      subtitle: '20の機能 — 初めてのエージェントからRAGパイプラインまで'
    },
    nav: {
      begin: '初級',
      mid:   '中級',
      adv:   '上級'
    },
    levels: {
      begin: { title: '初級', desc: 'コアコンセプト — ここから始めましょう' },
      mid:   { title: '中級', desc: 'ツールと安全性 — エージェントを実用的で安全に' },
      adv:   { title: '上級', desc: 'パターンとオーケストレーション — 高度なワークフローを設計' }
    },
    // Keyed by the ID passed to showFeature()
    features: {
      '01': { title: 'エージェントの基本設定',         desc: 'システムプロンプトを使ってAgenticProcessCall要素を設定し、初めてのAIエージェントを作成します。' },
      '02': { title: '構造化出力',                     desc: 'エージェントがフリーテキストの代わりに型付きJavaオブジェクトとして応答するよう指示します。' },
      '03': { title: 'モデルプロバイダーの選択',        desc: '6つのサポートされるAIプロバイダーから選択し、変数で設定します。' },
      '04': { title: 'ファイル抽出',                   desc: '画像やPDFを添付し、モデルが視覚的に読み取って構造化データを抽出します。' },
      '05': { title: '呼び出し可能プロセスツール',      desc: 'タグ1つでIvyの呼び出し可能サブプロセスをAIが発見できるツールに変えます。' },
      '06': { title: 'Javaツール',                     desc: 'JavaでSmartWorkflowToolを実装し、SPIで登録されるコードのみのツールロジック。' },
      '07': { title: 'ウェブ検索ツール',                desc: 'DuckDuckGo経由でエージェントがインターネット検索できる組み込みツール。' },
      '08': { title: '観測可能性',                      desc: 'Arize PhoenixでLLM呼び出しをトレース — コード変更不要。' },
      '09': { title: '出力ガードレール',                desc: '組み込みのSensitiveDataOutputGuardrailでAIレスポンスの機密データをブロック。' },
      '10': { title: '入力ガードレール',                desc: '組み込みのPromptInjectionInputGuardrailでプロンプトインジェクション攻撃をブロック。' },
    }
  };

  // ── EN originals snapshot (captured once from the DOM on first lang switch) ─
  var _enSnapshot = null;

  function _captureEnSnapshot() {
    var snap = { hero: {}, nav: {}, levels: {}, features: {} };

    var h1 = document.querySelector('.sw-hero h1');
    var subtitle = document.querySelector('.sw-hero p');
    snap.hero.title    = h1       ? h1.textContent       : '';
    snap.hero.subtitle = subtitle ? subtitle.textContent : '';

    document.querySelectorAll('.sw-level-pill[data-lv]').forEach(function(pill) {
      var lv = pill.getAttribute('data-lv');
      var text = '';
      pill.childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      });
      snap.nav[lv] = text.trim();
    });

    document.querySelectorAll('.sw-level-section[data-lv]').forEach(function(section) {
      var lv   = section.getAttribute('data-lv');
      var h2   = section.querySelector('.sw-level-header h2');
      var desc = section.querySelector('.sw-level-desc');
      snap.levels[lv] = {
        title: h2   ? h2.textContent   : '',
        desc:  desc ? desc.textContent : ''
      };
    });

    document.querySelectorAll('.sw-card[onclick]').forEach(function(card) {
      var m = card.getAttribute('onclick').match(/showFeature\('(\d+)'\)/);
      if (!m) return;
      var id    = m[1];
      var title = card.querySelector('.sw-card-title');
      var desc  = card.querySelector('.sw-card-desc');
      snap.features[id] = {
        title: title ? title.textContent : '',
        desc:  desc  ? desc.textContent  : ''
      };
    });

    return snap;
  }

  function _applyLangToIndex(lang) {
    if (!_enSnapshot) _enSnapshot = _captureEnSnapshot();

    var src = lang === 'jp' ? JP_UI : null; // null → restore EN

    // Hero
    var h1 = document.querySelector('.sw-hero h1');
    var subtitle = document.querySelector('.sw-hero p');
    if (h1)       h1.textContent       = src ? src.hero.title    : _enSnapshot.hero.title;
    if (subtitle) subtitle.textContent = src ? src.hero.subtitle : _enSnapshot.hero.subtitle;

    // Nav pills (text node after the kanji <span>)
    document.querySelectorAll('.sw-level-pill[data-lv]').forEach(function(pill) {
      var lv = pill.getAttribute('data-lv');
      var jpText = src && src.nav[lv];
      var enText = _enSnapshot.nav[lv];
      pill.childNodes.forEach(function(node) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
          node.textContent = ' ' + (jpText || enText || '');
        }
      });
    });

    // Level section headers
    document.querySelectorAll('.sw-level-section[data-lv]').forEach(function(section) {
      var lv   = section.getAttribute('data-lv');
      var h2   = section.querySelector('.sw-level-header h2');
      var desc = section.querySelector('.sw-level-desc');
      var jpLv = src && src.levels[lv];
      var enLv = _enSnapshot.levels[lv] || {};
      if (h2)   h2.textContent   = jpLv ? jpLv.title : (enLv.title || '');
      if (desc) desc.textContent = jpLv ? jpLv.desc  : (enLv.desc  || '');
    });

    // Feature cards
    document.querySelectorAll('.sw-card[onclick]').forEach(function(card) {
      var m = card.getAttribute('onclick').match(/showFeature\('(\d+)'\)/);
      if (!m) return;
      var id    = m[1];
      var titleEl = card.querySelector('.sw-card-title');
      var descEl  = card.querySelector('.sw-card-desc');
      var jpFeat  = src && src.features[id];
      var enFeat  = _enSnapshot.features[id] || {};
      if (titleEl) titleEl.textContent = jpFeat ? jpFeat.title : (enFeat.title || '');
      if (descEl)  descEl.textContent  = jpFeat ? jpFeat.desc  : (enFeat.desc  || '');
    });
  }

  // ── FeatureRenderer ────────────────────────────────────────────────────────
  class FeatureRenderer {

    render(id) {
      var divId = currentLang === 'jp' ? 'sw-md-jp-' + id : 'sw-md-' + id;
      var el = document.getElementById(divId);

      // Fall back to EN if JP content is empty
      if (currentLang === 'jp' && (!el || !el.textContent.trim())) {
        el = document.getElementById('sw-md-' + id);
      }

      let md = el ? el.textContent.trim() : '';
      md = this._preprocessMarkdown(md);
      if (!md) {
        md = '# Feature ' + id + '\n\n> Content coming soon. Check back after the CMS entries are uploaded.';
      }

      if (window.marked) {
        const renderer = new marked.Renderer();
        renderer.link = function(hrefOrToken, title, text) {
          var href, linkTitle, linkText;
          if (hrefOrToken && typeof hrefOrToken === 'object') {
            href = hrefOrToken.href;
            linkTitle = hrefOrToken.title;
            linkText = hrefOrToken.text;
          } else {
            href = hrefOrToken;
            linkTitle = title;
            linkText = text;
          }
          if (href && href.startsWith('feature:')) {
            var featureId = href.slice(8);
            return '<a href="javascript:void(0)" onclick="showFeature(\'' + featureId + '\')" class="sw-feature-link">' + linkText + '</a>';
          }
          var t = linkTitle ? ' title="' + linkTitle + '"' : '';
          return '<a href="' + href + '"' + t + ' target="_blank" rel="noopener">' + linkText + '</a>';
        };
        marked.setOptions({
          renderer,
          gfm: true,
          breaks: false,
          highlight(code, lang) {
            if (window.hljs) {
              try {
                return lang && hljs.getLanguage(lang)
                  ? hljs.highlight(code, { language: lang }).value
                  : hljs.highlightAuto(code).value;
              } catch (e) { return code; }
            }
            return code;
          }
        });
      }

      const html = window.marked ? marked.parse(md) : `<pre>${md}</pre>`;
      document.getElementById('feature-article').innerHTML = html;

      if (window.hljs) {
        document.querySelectorAll('#feature-article pre code').forEach(el => {
          if (!el.classList.contains('hljs')) hljs.highlightElement(el);
        });
      }

      this._buildToc();
    }

    _buildCmsImageMap() {
      var map = {};
      document.querySelectorAll('#sw-cms-img-data span[data-cms-path]').forEach(function(span) {
        var img = span.querySelector('img');
        if (img) map[span.getAttribute('data-cms-path')] = img.src;
      });
      return map;
    }

    _preprocessMarkdown(md) {
      var map = this._buildCmsImageMap();
      md = md.replace(/\(cms:(\/[^)]+)\)/g, function(_, path) {
        return '(' + (map[path] || '#') + ')';
      });
      var linkMap = currentLang === 'jp' ? FEATURE_LINK_MAP_JP : FEATURE_LINK_MAP;
      md = md.replace(/\[([^\]]+)\](?!\s*[\(\[])/g, function(match, text) {
        var id = linkMap[text];
        return id ? '[' + text + '](feature:' + id + ')' : match;
      });
      return md;
    }

    _buildToc() {
      const headings = document.querySelectorAll('#feature-article h2');
      const toc = document.getElementById('feature-toc');
      if (!toc) return;

      var strings = UI_STRINGS[currentLang] || UI_STRINGS.en;

      var langToggle = '<div class="sw-lang-toggle sw-lang-toggle-sidebar">'
        + '<button class="sw-lang-btn' + (currentLang === 'en' ? ' active' : '') + '" data-lang="en" onclick="setLang(\'en\')">EN</button>'
        + '<button class="sw-lang-btn' + (currentLang === 'jp' ? ' active' : '') + '" data-lang="jp" onclick="setLang(\'jp\')">JP</button>'
        + '</div>';

      let html = '<a class="sidebar-back" onclick="showGrid()" style="cursor:pointer">' + strings.back + '</a>'
        + langToggle;
      if (headings.length) {
        html += '<h4>' + strings.onThisPage + '</h4><ul>';
        headings.forEach((h, i) => {
          const id = 'toc-section-' + i;
          h.id = id;
          html += `<li><a href="#${id}">${h.textContent}</a></li>`;
        });
        html += '</ul>';
      }
      toc.innerHTML = html;
    }
  }

  // ── Language switcher ───────────────────────────────────────────────────────

  function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('sw-lang', lang);
    _applyLangToIndex(lang);
    _updateLangButtons();
    if (currentFeatureId && document.getElementById('view-detail').style.display !== 'none') {
      window.swRenderer.render(currentFeatureId);
    }
  }

  function _updateLangButtons() {
    document.querySelectorAll('.sw-lang-btn[data-lang]').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === currentLang);
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function showFeature(id) {
    currentFeatureId = id;
    document.getElementById('view-index').style.display = 'none';
    var detail = document.getElementById('view-detail');
    detail.style.display = 'block';
    window.scrollTo(0, 0);
    if (window.swRenderer) window.swRenderer.render(id);
  }

  function showGrid() {
    document.getElementById('view-detail').style.display = 'none';
    document.getElementById('view-index').style.display = 'block';
    window.scrollTo(0, 0);
  }

  // ── Level pill active state on scroll ──────────────────────────────────────

  function initLevelNav() {
    var sections = document.querySelectorAll('.sw-level-section');
    var pills = document.querySelectorAll('.sw-level-pill');
    if (!sections.length || !pills.length) return;
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var lv = entry.target.getAttribute('data-lv');
          pills.forEach(function(p) {
            p.classList.toggle('active', p.getAttribute('data-lv') === lv);
          });
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(function(s) { observer.observe(s); });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function() {
    initLevelNav();
    window.swRenderer = new FeatureRenderer();
    // Apply saved language preference immediately
    if (currentLang !== 'en') {
      _applyLangToIndex(currentLang);
    }
    _updateLangButtons();
  });

  // Expose globals
  window.showFeature = showFeature;
  window.showGrid    = showGrid;
  window.setLang     = setLang;

})();
