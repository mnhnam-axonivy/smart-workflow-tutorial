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
    'PII Masking Guardrail': '11',
    'Conversation Memory': '12',
    'Human in the Loop': '13',
    'Practice 01 — Agent Pattern: AI Task': 'p01',
    'Practice 02 — Agent Pattern: Subprocess Design and Tool Co-location': 'p02',
    'Practice 03 — Agent Organisation: Folder Structure and Naming Conventions': 'p03',
    'Practice 05 — Agent Prompts: Clarity and Dynamic Context': 'p05',
    'Agent Pattern: AI Task': 'p01',
    'Agent Pattern: Subprocess Design and Tool Co-location': 'p02',
    'Agent Organisation: Folder Structure and Naming Conventions': 'p03',
    'Agent Prompts: Clarity and Dynamic Context': 'p05',
    'What is RAG (Appendix A)': 'a01',
    'What is RAG': 'a01',
    'RAG as a Tool (Feature 14)': '14',
    'RAG as a Tool': '14',
    'How LLMs Understand Language': 'a02',
    'Running a Local Vector Store': 'a03',
    'Local Vector Store': 'a03',
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
    'PIIマスキングガードレール': '11',
    '会話メモリ': '12',
    'ヒューマンインザループ': '13',
    'プラクティス 01 — エージェントパターン: AIタスク': 'p01',
    'プラクティス 02 — エージェントパターン: サブプロセス設計とツールの同一配置': 'p02',
    'プラクティス 03 — エージェント構成: フォルダ構造と命名規則': 'p03',
    'プラクティス 05 — エージェントプロンプト: 明確さと動的コンテキスト': 'p05',
    'RAGとは（付録A）': 'a01',
    'RAGとは？': 'a01',
    'ツールとしてのRAG（Feature 14）': '14',
    'ツールとしてのRAG': '14',
    'LLMは言語をどのように理解するか': 'a02',
    'ローカルベクターストアの起動': 'a03',
    '基本的なエージェント設定': '01',
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
      begin:    '初級',
      mid:      '中級',
      exp:      'エキスパート',
      adv:      '上級',
      bp:       'ベストプラクティス',
      appendix: '附録'
    },
    levels: {
      begin:    { title: '初級',                   desc: 'コアコンセプト — ここから始めましょう' },
      mid:      { title: '中級',                   desc: 'ツールと安全性 — エージェントを実用的で安全に' },
      exp:      { title: 'エキスパート',            desc: '高度な統合 — 限界に挑戦' },
      adv:      { title: '上級',                   desc: 'パターンとオーケストレーション — 高度なワークフローを設計' },
      bp:       { title: 'ベストプラクティス',      desc: '本番対応AIワークフローのパターンとアンチパターン' },
      appendix: { title: '附録',                   desc: '補足資料 — リファレンスと追加情報' }
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
      '09': { title: '出力ガードレール',                desc: 'AIレスポンスがユーザーに届く前に検証 — 組み込みの出力ガードレールで有害または機密コンテンツをブロック。' },
      '10': { title: '入力ガードレール',                desc: 'ユーザーメッセージがモデルに届く前に検証 — 組み込みの入力ガードレールでプロンプトインジェクションや悪意ある入力をブロック。' },
      '11': { title: 'PIIマスキングガードレール',       desc: 'ユーザーメッセージの個人情報をLLMに届く前に匿名化し、レスポンスで元の値を復元。' },
      '12': { title: '会話メモリ',                      desc: 'データクラスのフィールド1つでエージェントが過去のターンを記憶し、一貫したマルチターン対話を構築。' },
      '13': { title: 'ヒューマンインザループ',           desc: 'エージェントの実行を一時停止し、決定を人間タスクにルーティング — ユーザーの選択後、エージェントが自動的に再開。' },
      'p01': { title: 'エージェントパターン：AIタスク', desc: 'ルーティンの人間承認をAI決定で置き換え、型付き結果をプロセスデータに直接書き込みます。' },
      'p02': { title: 'エージェントパターン：サブプロセス設計とツールの同一配置', desc: '呼び出し可能なサブプロセスに抽出するタイミングと、ツールをオーケストレータと同一ファイルに配置するタイミングを判断します。' },
      'p03': { title: 'エージェント整理：フォルダ構造と命名規則', desc: 'エージェントファイルを専用のagents/フォルダに整理し、プロセスファイル・呼び出し可能プロセス・データクラスに一貫した命名規則を適用します。' },
      'p05': { title: 'エージェントプロンプト：明瞭さと動的コンテキスト', desc: 'ツールメソッド名を含まないシステムプロンプトを書き、EL式で今日の日付・ユーザーロケール・プロセスデータをリアルタイムにプロンプトへ注入します。' },
      'a01': { title: 'RAGとは？', desc: '検索拡張生成（RAG）の仕組みを解説 — モデルの再学習なしに、自社ドキュメントをAIエージェントへリアルタイムで提供する技術。' },
      'a02': { title: 'LLMは言語をどのように理解するか', desc: 'モデルの内部を覗く — テキストが数値、埋め込み、そして回答へと変換される仕組み。' },
      'a03': { title: 'ローカルベクターストアの起動', desc: '開発・チュートリアル演習用にDockerでローカルのOpenSearchインスタンスをセットアップする。' },
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
      var m = card.getAttribute('onclick').match(/showFeature\('([\w]+)'\)/);
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
      var m = card.getAttribute('onclick').match(/showFeature\('([\w]+)'\)/);
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
      var enMap = {};
      document.querySelectorAll('#sw-cms-img-data span[data-cms-path]').forEach(function(span) {
        var img = span.querySelector('img');
        if (img) enMap[span.getAttribute('data-cms-path')] = img.src;
      });
      var jpMap = {};
      document.querySelectorAll('#sw-cms-img-data-jp span[data-cms-path-ja]').forEach(function(span) {
        var img = span.querySelector('img');
        if (img && img.src && img.src.startsWith('data:')) {
          jpMap[span.getAttribute('data-cms-path-ja')] = img.src;
        }
      });
      return { en: enMap, jp: jpMap };
    }

    _preprocessMarkdown(md) {
      var maps = this._buildCmsImageMap();
      md = md.replace(/\(cms:(\/[^)]+)\)/g, function(_, path) {
        var url = (currentLang === 'jp' && maps.jp[path]) ? maps.jp[path] : maps.en[path];
        return '(' + (url || '#') + ')';
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
