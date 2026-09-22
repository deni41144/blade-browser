// ==UserScript==
// @name            Blade Newtab Hero
// @description     Hero-циферблат на новой вкладке (GX-стиль): приветствие,
//                  большие часы, дата, статус, хроника. Только about:newtab/home —
//                  на остальных страницах время показывают навбар-часы
//                  (BladeClock 2.6.0 сам прячется на главной: дублей нет).
// @author          Bobliks-Creations
// @include         main
// @version         1.9.0
// ==/UserScript==
(function () {
  if (window.BladeNewtabHero) return;

  // Диаг по конвенции проекта
  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\newtab_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.9.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  // ВАЖНО: about:newtab в FF155 — builtin-addon в REMOTE-процессе (проверено:
  // isRemoteBrowser=true, document-element-inserted в родителя не приходит).
  // Поэтому hero рисуется в ОКНЕ (chrome), поверх зоны контента, и показывается
  // только когда выбран about:newtab/about:home — раскладка «у каждой странице
  // свой часы»: главная — большие Hero, остальные — навбар (BladeClock).
  // Акцент — chrome-переменная --accent из userChrome.css: переключается
  // темами живьём (data-blade-theme).
  const HERO_CSS = `
    #browser { position: relative; }
    #blade-hero-wrap {
      position: absolute; inset: 0; z-index: 5;
      pointer-events: none; display: none;
      justify-content: center; align-items: flex-start;
    }
    #blade-hero-wrap.blade-on { display: flex; }
    #blade-hero {
      position: relative;
      /* [2026-09-15] Подъём Hero-часов до 5vh (было 10vh): обои V2 с высокими композициями */
      margin-top: 5vh; text-align: center;
      font-family: 'blade-horror', 'Segoe UI', sans-serif; user-select: none;
      animation: blade-hero-in .9s cubic-bezier(.2,.7,.3,1) both;
    }
    @keyframes blade-hero-in {
      from { opacity: 0; transform: translateY(-12px); }
      to   { opacity: 1; transform: none; }
    }
    #blade-hero .bh-greet {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 16px; font-weight: 800; letter-spacing: 10px;
      text-transform: uppercase;
      margin-bottom: 12px;
      /* кровь-градиент + двойное свечение — демонический облик */
      background: linear-gradient(180deg,
        color-mix(in srgb, var(--accent, #ff2a2a) 85%, #fff) 0%,
        var(--accent, #ff2a2a) 40%,
        color-mix(in srgb, var(--accent, #ff2a2a) 45%, #000) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter: drop-shadow(0 0 12px color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent))
              drop-shadow(0 0 28px color-mix(in srgb, var(--accent, #ff2a2a) 30%, transparent));
      /* Появляется и тает, оставляя чистые часы: подъём с opacity при входе,
         пауза, плавный уход вверх с растворением. Только transform/opacity —
         раскладку не дёргаем (margin-bottom на месте, элемент не схлопывается).
         Перезапуск сам: blade-on переключает display none<->flex (updateVisible). */
      opacity: 0;
      animation: blade-greet-life 7s ease forwards;
    }
    @keyframes blade-greet-life {
      0%   { opacity: 0; transform: translateY(8px); }
      10%  { opacity: 1; transform: none; }
      55%  { opacity: 1; }
      78%  { opacity: 0; transform: translateY(-6px); }
      100% { opacity: 0; }
    }
    /* Katana Shimmer Keyframe: скользящий диагональный срез света по цифрам раз в 7.5с (100% непрозрачные цвета) */
    @keyframes blade-katana-glint {
      0%   { background-position: -60% 0; }
      22%  { background-position: 160% 0; }
      100% { background-position: 160% 0; }
    }

    @keyframes blade-katana-glint-blood {
      0%   { background-position: -60% 0, 0 0; }
      22%  { background-position: 160% 0, 0 0; }
      100% { background-position: 160% 0, 0 0; }
    }

    #blade-hero .bh-clock {
      position: relative;
      display: inline-flex;
      align-items: baseline;
      justify-content: center;
      line-height: 1;
      animation: blade-hero-breathe 3.6s ease-in-out infinite;
    }
    @keyframes blade-hero-breathe {
      0%, 100% { opacity: 0.94; }
      50%      { opacity: 1; }
    }
    #blade-hero .bh-clock::before,
    #blade-hero .bh-clock::after {
      content: none !important;
      display: none !important;
    }

    #blade-hero .bh-hm {
      display: inline-block;
      line-height: 1;
      white-space: nowrap;
      user-select: none;
    }
    /* --- red (дефолт) / custom — благородный алый монолит AVA 3.0 --- */
    #blade-hero .bh-clock {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 88px;
      font-weight: 700;
      letter-spacing: 6px;
    }
    #blade-hero .bh-hm {
      background: linear-gradient(115deg, #ffffff 0%, #ffffff 38%, color-mix(in srgb, var(--accent, #ff2a2a) 70%, #fff) 46%, #ffffff 50%, color-mix(in srgb, var(--accent, #ff2a2a) 70%, #fff) 54%, #ffffff 62%, #ffffff 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 2px #ffffff)
        drop-shadow(0 0 12px color-mix(in srgb, var(--accent, #ff2a2a) 85%, #ff4d4d))
        drop-shadow(0 0 32px color-mix(in srgb, var(--accent, #ff2a2a) 65%, transparent))
        drop-shadow(0 0 72px color-mix(in srgb, var(--accent, #ff2a2a) 35%, transparent))
        drop-shadow(0 4px 22px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
      animation: blade-katana-glint 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }

    /* --- blood — демонический рубиновый клинок: цельный срез катаны Unbounded 800 --- */
    [data-blade-theme="blood"] #blade-hero .bh-clock {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 88px;
      font-weight: 800;
      letter-spacing: 6px;
    }
    [data-blade-theme="blood"] #blade-hero .bh-hm {
      /* двухслойный фон: верхний — проходящий катана-блик (прозрачный вне полосы),
         нижний — статичный металлический градиент, дающий объём в покое */
      background:
        linear-gradient(115deg, transparent 0%, transparent 38%, rgba(255,140,160,0.35) 44%, #ffffff 50%, rgba(255,140,160,0.35) 56%, transparent 62%, transparent 100%),
        linear-gradient(180deg, #ffffff 0%, #fbe7ec 55%, #f2c0cc 100%);
      background-size: 260% 100%, 100% 100%;
      background-position: -60% 0, 0 0;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 1px #ffffff)
        drop-shadow(0 0 8px #ff1a40)
        drop-shadow(0 0 22px #d60029)
        drop-shadow(0 0 45px rgba(214, 0, 41, 0.85))
        drop-shadow(0 4px 22px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.95));
      animation: blade-katana-glint-blood 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }

    [data-blade-theme="blood"] #blade-hero .bh-sec {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #ffffff;
      text-shadow:
        0 0 2px #ffffff,
        0 0 8px #ff2a4b,
        0 0 16px rgba(214, 0, 41, 0.8),
        0 2px 8px rgba(0, 0, 0, 0.95);
    }

    /* --- purple — неоновая трубка Monoton: чистый ультрафиолетовый плазменный импульс --- */
    [data-blade-theme="purple"] #blade-hero .bh-clock {
      font-family: 'blade-neon', 'Segoe UI', sans-serif;
      font-size: 84px;
      letter-spacing: 5px;
    }
    [data-blade-theme="purple"] #blade-hero .bh-hm {
      background: linear-gradient(115deg, #ffffff 0%, #ffffff 38%, #d075ff 46%, #ffffff 50%, #b44bff 54%, #ffffff 62%, #ffffff 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 3px #ffffff)
        drop-shadow(0 0 10px #d075ff)
        drop-shadow(0 0 25px #b44bff)
        drop-shadow(0 0 55px rgba(180, 75, 255, 0.75))
        drop-shadow(0 4px 20px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
      animation: blade-katana-glint 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }


    /* --- green — CRT-терминал VT323: изумрудный тактический луч --- */
    [data-blade-theme="green"] #blade-hero .bh-clock {
      font-family: 'blade-terminal', 'Segoe UI', sans-serif;
      font-size: 100px;
      letter-spacing: 7px;
    }
    [data-blade-theme="green"] #blade-hero .bh-hm {
      background: linear-gradient(115deg, #e6fff2 0%, #e6fff2 38%, #00ff88 46%, #ffffff 50%, #00ff88 54%, #e6fff2 62%, #e6fff2 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 3px #ffffff)
        drop-shadow(0 0 10px #33ff9f)
        drop-shadow(0 0 24px #00ff88)
        drop-shadow(0 0 50px rgba(0, 255, 136, 0.65))
        drop-shadow(0 4px 20px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
      animation: blade-katana-glint 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }


    /* --- grey — титан и платина Unbounded 800: алмазный срез Masamune --- */
    [data-blade-theme="grey"] #blade-hero .bh-clock {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 88px;
      font-weight: 800;
      letter-spacing: 6px;
    }
    [data-blade-theme="grey"] #blade-hero .bh-hm {
      background: linear-gradient(115deg, #ffffff 0%, #ffffff 38%, #c5d5ea 46%, #ffffff 50%, #c5d5ea 54%, #ffffff 62%, #ffffff 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 1px #ffffff)
        drop-shadow(0 0 10px rgba(255, 255, 255, 0.85))
        drop-shadow(0 0 24px rgba(216, 225, 238, 0.65))
        drop-shadow(0 0 55px rgba(170, 185, 205, 0.45))
        drop-shadow(0 4px 24px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.95));
      animation: blade-katana-glint 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }

    [data-blade-theme="grey"] #blade-hero .bh-sec {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #e4e8f0;
      text-shadow:
        0 0 2px #ffffff,
        0 0 8px rgba(220, 230, 245, 0.7),
        0 2px 8px rgba(0, 0, 0, 0.95);
    }

    /* --- orange — обожжённые буквы Rubik Burned: магматическое пламя --- */
    [data-blade-theme="orange"] #blade-hero .bh-clock {
      font-family: 'blade-fire', 'Segoe UI', sans-serif;
      font-size: 88px;
      letter-spacing: 8px;
    }
    [data-blade-theme="orange"] #blade-hero .bh-hm {
      background: linear-gradient(115deg, #ffffff 0%, #ffe17d 25%, #ff881f 44%, #ffffff 50%, #ff881f 56%, #d14500 78%, #ffa033 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 1px #fff0b3)
        drop-shadow(0 0 14px #ff6a1f)
        drop-shadow(0 0 35px rgba(255, 106, 31, 0.65))
        drop-shadow(0 4px 20px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
      animation: blade-katana-glint 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }

    [data-blade-theme="orange"] #blade-hero .bh-sec {
      background: linear-gradient(180deg, #ffffff 0%, #ffa033 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter: drop-shadow(0 0 8px #ff881f) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
    }

    /* --- cherry — японский деко-сериф Kaisei Decol: морозный розовый хрусталь --- */
    [data-blade-theme="cherry"] #blade-hero .bh-clock {
      font-family: 'blade-sakura', 'Segoe UI', sans-serif;
      font-size: 88px;
      letter-spacing: 6px;
    }
    [data-blade-theme="cherry"] #blade-hero .bh-hm {
      background: linear-gradient(115deg, #fff0f4 0%, #fff0f4 38%, #ff758f 46%, #ffffff 50%, #ff758f 54%, #fff0f4 62%, #fff0f4 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 2px #ffffff)
        drop-shadow(0 0 10px #ff758f)
        drop-shadow(0 0 26px #d02d4e)
        drop-shadow(0 0 55px rgba(208, 45, 78, 0.6))
        drop-shadow(0 4px 20px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
      animation: blade-katana-glint 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }


    /* --- midnight — небесный арктический Unbounded 800: сияние авроры и звездный лед --- */
    [data-blade-theme="midnight"] #blade-hero .bh-clock {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 88px;
      font-weight: 800;
      letter-spacing: 6px;
    }
    [data-blade-theme="midnight"] #blade-hero .bh-hm {
      background: linear-gradient(115deg, #f0faff 0%, #f0faff 38%, #00e5ff 46%, #ffffff 50%, #2f6bff 54%, #f0faff 62%, #f0faff 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 2px #ffffff)
        drop-shadow(0 0 10px #00e5ff)
        drop-shadow(0 0 26px #2f6bff)
        drop-shadow(0 0 65px rgba(47, 107, 255, 0.65))
        drop-shadow(0 0 95px rgba(0, 229, 255, 0.35))
        drop-shadow(0 4px 20px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
      animation: blade-katana-glint 7.5s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }


    /* --- volt — электрический глитч Rubik Glitch: ослепительный высоковольтный разряд --- */
    [data-blade-theme="volt"] #blade-hero .bh-clock {
      font-family: 'blade-volt', 'Segoe UI', sans-serif;
      font-size: 86px;
      letter-spacing: 7px;
    }
    [data-blade-theme="volt"] #blade-hero .bh-hm {
      background: linear-gradient(115deg, #ffffff 0%, #ffffff 38%, #ffff66 46%, #ffffff 50%, #ffff66 54%, #ffffff 62%, #ffffff 100%);
      background-size: 260% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      filter:
        drop-shadow(0 0 3px #ffffff)
        drop-shadow(0 0 10px #ffff4d)
        drop-shadow(0 0 24px #fff820)
        drop-shadow(0 0 55px rgba(255, 248, 32, 0.7))
        drop-shadow(0 0 90px rgba(255, 248, 32, 0.35))
        drop-shadow(0 4px 20px rgba(0, 0, 0, 0.98))
        drop-shadow(0 2px 4px rgba(0, 0, 0, 0.9));
      animation: blade-katana-glint 6.8s cubic-bezier(0.22, 1, 0.36, 1) infinite;
    }


    /* --- custom — конструктор: автонаследование от --accent --- */
    [data-blade-theme="custom"] #blade-hero .bh-clock {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      font-size: 88px;
      font-weight: 300;
      letter-spacing: 6px;
    }
    /* Атмосферные «уголки» за часами: два радиальных пятна акцента,
       медленный дрейф transform + лёгкий пульс opacity (композит, дёшево) */
    #blade-hero::before, #blade-hero::after {
      content: '';
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: -1;
    }
    #blade-hero::before {
      top: -90px; left: -140px; width: 320px; height: 320px;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent, #ff2a2a) 13%, transparent) 0%, transparent 70%);
      animation: blade-hero-drift-a 9s ease-in-out infinite alternate;
    }
    #blade-hero::after {
      bottom: -120px; right: -140px; width: 380px; height: 380px;
      background: radial-gradient(circle, color-mix(in srgb, var(--accent, #ff2a2a) 11%, transparent) 0%, transparent 70%);
      animation: blade-hero-drift-b 13s ease-in-out infinite alternate;
    }
    @keyframes blade-hero-drift-a {
      from { transform: translate(-18px, -8px); opacity: 0.55; }
      to   { transform: translate(18px, 8px);   opacity: 1; }
    }
    @keyframes blade-hero-drift-b {
      from { transform: translate(18px, 10px);   opacity: 0.5; }
      to   { transform: translate(-18px, -10px); opacity: 0.9; }
    }
    #blade-hero .bh-sec {
      font-size: 26px; font-weight: 300; letter-spacing: 2px;
      color: color-mix(in srgb, var(--accent, #ff2a2a) 78%, white);
      margin-left: 10px; vertical-align: 14px;
    }
    /* AVA 3.0: фирменная лазерная грань-разделитель под циферблатом */
    #blade-hero .bh-accent-line {
      position: relative;
      width: 240px; height: 1px;
      margin: 14px auto 10px auto;
      background: linear-gradient(90deg,
        transparent 0%,
        color-mix(in srgb, var(--accent, #ff2a2a) 40%, transparent) 20%,
        var(--accent, #ff2a2a) 50%,
        color-mix(in srgb, var(--accent, #ff2a2a) 40%, transparent) 80%,
        transparent 100%);
      box-shadow: 0 0 10px color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent), 0 0 4px var(--accent, #ff2a2a);
      display: flex; align-items: center; justify-content: center;
    }
    #blade-hero .bh-accent-core {
      width: 5px; height: 5px;
      background: #ffffff;
      transform: rotate(45deg);
      box-shadow: 0 0 6px #ffffff, 0 0 12px var(--accent, #ff2a2a);
    }
    #blade-hero .bh-date {
      font-family: var(--blade-display, 'Unbounded', 'Segoe UI', sans-serif);
      margin-top: 10px; font-size: 14px; font-weight: 600; letter-spacing: 4px;
      text-transform: uppercase; color: rgba(255, 255, 255, 0.78);
      text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
    }
    #blade-hero .bh-status {
      font-family: var(--blade-mono, 'JetBrains Mono', monospace);
      margin-top: 12px; font-size: 11px; font-weight: 700; letter-spacing: 3px;
      color: var(--accent, #ff2a2a);
      text-shadow: 0 0 10px color-mix(in srgb, var(--accent, #ff2a2a) 55%, transparent);
    }
    /* 4 состояния Hero: [Loading, Error, Empty, Success] */
    #blade-hero[data-state="loading"] .bh-clock { opacity: 0.6; }
    #blade-hero[data-state="error"] .bh-status { color: #ff3333; }
    #blade-hero[data-state="empty"] .bh-date { display: none; }
    #blade-hero[data-state="success"] { opacity: 1; }
    #blade-hero-chronicle {
      position: absolute; left: 18px; bottom: 14px;
      font-family: var(--blade-mono, 'JetBrains Mono', monospace); font-size: 10px; letter-spacing: 1px;
      color: var(--accent, #ff2a2a); opacity: 0.45; pointer-events: none;
      max-width: 42vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* ==========================================================================
       АТМОСФЕРНЫЕ ЭФФЕКТЫ ТЕМ В СВОБОДНЫХ ЗОНАХ (AVA 3.0 Live Atmosphere)
       По слову владельца: стекающая кровь, бьющие молнии, летающая сакура и т.д.
       Работает ТОЛЬКО на about:newtab/home внутри #blade-hero-wrap, нулевой лаг (GPU)
       ========================================================================== */
    #blade-atmosphere {
      position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1;
    }
    :root[data-blade-battery] #blade-atmosphere { display: none !important; }

    .ba-blood, .ba-volt, .ba-cherry, .ba-orange, .ba-midnight, .ba-green, .ba-purple, .ba-grey, .ba-red {
      display: none; position: absolute; inset: 0; pointer-events: none;
    }
    [data-blade-theme="blood"] .ba-blood { display: block; }
    [data-blade-theme="volt"] .ba-volt { display: block; }
    [data-blade-theme="cherry"] .ba-cherry { display: block; }
    [data-blade-theme="orange"] .ba-orange { display: block; }
    [data-blade-theme="midnight"] .ba-midnight { display: block; }
    [data-blade-theme="green"] .ba-green { display: block; }
    [data-blade-theme="purple"] .ba-purple { display: block; }
    [data-blade-theme="grey"] .ba-grey { display: block; }
    [data-blade-theme="red"] .ba-red,
    [data-blade-theme="custom"] .ba-red { display: block; }

    /* --- blood: Демонический кровавый туман, разящий след чибуруи (стряхивание крови) и тёмные рубиновые искры --- */
    .ba-blood-mist {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 85% 55% at 50% 95%, rgba(160, 0, 20, 0.18) 0%, rgba(70, 0, 8, 0.08) 50%, transparent 75%);
      filter: blur(16px);
      pointer-events: none;
      animation: ba-blood-mist-pulse 9s ease-in-out infinite alternate;
    }
    @keyframes ba-blood-mist-pulse {
      0%   { opacity: 0.45; transform: scale(0.97); }
      100% { opacity: 0.95; transform: scale(1.03); }
    }
    .ba-blood-arc {
      position: absolute; top: 12%; right: 14%; width: 280px; height: 160px;
      filter: drop-shadow(0 0 4px #ffffff) drop-shadow(0 0 12px #ff1a40) drop-shadow(0 0 35px rgba(214, 0, 41, 0.85));
      opacity: 0; pointer-events: none;
      animation: ba-blood-slash-strike 8.5s cubic-bezier(0.16, 1, 0.3, 1) infinite;
    }
    .ba-blood-arc path {
      stroke: #ff2a4b; stroke-width: 2.2; stroke-linecap: round;
    }
    .ba-blood-flash {
      position: absolute; inset: 0;
      background: radial-gradient(circle at 75% 25%, rgba(255, 26, 60, 0.14) 0%, transparent 60%);
      opacity: 0; pointer-events: none;
      animation: ba-blood-sky-flash 8.5s linear infinite;
    }
    @keyframes ba-blood-slash-strike {
      0%, 90%  { opacity: 0; transform: scale(0.7) translate(25px, -25px); }
      91%      { opacity: 1; transform: scale(1.05) translate(0, 0); }
      93%      { opacity: 0.95; transform: scale(1) translate(0, 0); }
      95%      { opacity: 0.3; }
      100%     { opacity: 0; transform: scale(1.02) translate(-8px, 8px); }
    }
    @keyframes ba-blood-sky-flash {
      0%, 90%  { opacity: 0; }
      91%      { opacity: 0.85; }
      92.5%    { opacity: 0.15; }
      93.5%    { opacity: 0.6; }
      95%      { opacity: 0; }
      100%     { opacity: 0; }
    }
    .ba-blood-mote {
      position: absolute; top: -10px;
      width: 3px; height: 3px; border-radius: 50%;
      background: #ff2a4b;
      box-shadow: 0 0 5px #ff2a4b, 0 0 12px rgba(180, 0, 25, 0.6);
      opacity: 0; pointer-events: none;
    }
    .ba-bm1 { left: 18%; animation: ba-bmote-fall 11s linear 0s infinite; }
    .ba-bm2 { left: 42%; animation: ba-bmote-fall 14s linear 3.5s infinite; }
    .ba-bm3 { left: 74%; animation: ba-bmote-fall 12s linear 1.5s infinite; }
    .ba-bm4 { left: 88%; animation: ba-bmote-fall 13.5s linear 5.5s infinite; }
    @keyframes ba-bmote-fall {
      0%   { transform: translateY(-10px) translateX(0); opacity: 0; }
      15%  { opacity: 0.7; }
      80%  { opacity: 0.6; }
      100% { transform: translateY(105vh) translateX(40px); opacity: 0; }
    }

    /* --- volt: Бьющая молния в небе + электрический разряд --- */
    .ba-lightning {
      position: absolute; right: 14%; top: 25px; width: 110px; height: 250px;
      filter: drop-shadow(0 0 8px #fff820) drop-shadow(0 0 20px rgba(255, 248, 32, 0.85)) drop-shadow(0 0 45px rgba(255, 230, 0, 0.5));
      opacity: 0;
      animation: ba-volt-strike 6.5s linear infinite;
    }
    .ba-lightning path {
      stroke: #ffffff; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round;
    }
    .ba-lightning-flash {
      position: absolute; inset: 0;
      background: radial-gradient(circle at 82% 22%, rgba(255, 248, 32, 0.16) 0%, transparent 60%);
      opacity: 0;
      animation: ba-volt-sky-flash 6.5s linear infinite;
    }
    @keyframes ba-volt-strike {
      0%, 93%    { opacity: 0; }
      94%        { opacity: 1; }
      95%        { opacity: 0.15; }
      96%        { opacity: 0.95; }
      97.5%      { opacity: 0.35; }
      98.5%      { opacity: 0.85; }
      100%       { opacity: 0; }
    }
    @keyframes ba-volt-sky-flash {
      0%, 93%    { opacity: 0; }
      94%, 96.5% { opacity: 0.85; }
      95%, 97.5% { opacity: 0.2; }
      100%       { opacity: 0; }
    }

    /* --- cherry: Летающие и кружащиеся лепестки сакуры --- */
    .ba-petal {
      position: absolute;
      width: 13px; height: 16px;
      background: linear-gradient(135deg, #ffffff 0%, #ffccd5 30%, #ff809b 80%, #d02d4e 100%);
      border-radius: 65% 15% 65% 15% / 65% 15% 65% 15%;
      box-shadow: 0 0 6px rgba(255, 128, 155, 0.65);
      opacity: 0;
    }
    .ba-p1 { left: 8%;  top: -20px; animation: ba-petal-fall 10s linear 0s infinite; }
    .ba-p2 { left: 22%; top: -20px; animation: ba-petal-fall 13s linear 2.5s infinite; }
    .ba-p3 { left: 38%; top: -20px; animation: ba-petal-fall 11s linear 5s infinite; }
    .ba-p4 { left: 55%; top: -20px; animation: ba-petal-fall 14s linear 1.2s infinite; }
    .ba-p5 { left: 70%; top: -20px; animation: ba-petal-fall 9.5s linear 3.8s infinite; }
    .ba-p6 { left: 84%; top: -20px; animation: ba-petal-fall 12s linear 6.5s infinite; }
    .ba-p7 { left: 93%; top: -20px; animation: ba-petal-fall 15s linear 4s infinite; }
    @keyframes ba-petal-fall {
      0%   { transform: translateY(-20px) translateX(0) rotate(0deg) rotateY(0deg); opacity: 0; }
      10%  { opacity: 0.85; }
      85%  { opacity: 0.75; }
      100% { transform: translateY(105vh) translateX(120px) rotate(420deg) rotateY(180deg); opacity: 0; }
    }

    /* --- orange: Поднимающиеся искры и угли магмы --- */
    .ba-ember {
      position: absolute; bottom: 0; border-radius: 50%;
      background: radial-gradient(circle, #fff3b0 10%, #ff881f 65%, #d14500 100%);
      box-shadow: 0 0 8px #ff881f, 0 0 16px rgba(255, 106, 31, 0.6);
      opacity: 0;
    }
    .ba-e1 { left: 15%; width: 5px; height: 5px; animation: ba-ember-up 8s ease-out 0s infinite; }
    .ba-e2 { left: 28%; width: 4px; height: 4px; animation: ba-ember-up 10s ease-out 2s infinite; }
    .ba-e3 { left: 45%; width: 6px; height: 6px; animation: ba-ember-up 7.5s ease-out 4s infinite; }
    .ba-e4 { left: 62%; width: 4px; height: 4px; animation: ba-ember-up 9s ease-out 1s infinite; }
    .ba-e5 { left: 78%; width: 5px; height: 5px; animation: ba-ember-up 11s ease-out 3.5s infinite; }
    .ba-e6 { left: 88%; width: 6px; height: 6px; animation: ba-ember-up 8.5s ease-out 5.5s infinite; }
    @keyframes ba-ember-up {
      0%   { transform: translateY(0) translateX(0); opacity: 0; }
      15%  { opacity: 0.9; }
      70%  { opacity: 0.7; }
      100% { transform: translateY(-75vh) translateX(35px); opacity: 0; }
    }

    /* --- midnight: Северное сияние, мерцающие звёзды и метеоры --- */
    .ba-aurora-ribbon {
      position: absolute; top: 0; left: 0; right: 0; height: 220px;
      background: radial-gradient(ellipse 75% 140px at 50% 0%, rgba(0, 229, 255, 0.14) 0%, rgba(47, 107, 255, 0.08) 50%, transparent 80%);
      filter: blur(8px);
      opacity: 0.65;
      animation: ba-aurora-breathe 8s ease-in-out infinite alternate;
    }
    @keyframes ba-aurora-breathe {
      0%   { transform: scaleX(0.95) scaleY(0.9); opacity: 0.5; }
      50%  { transform: scaleX(1.05) scaleY(1.15); opacity: 0.85; }
      100% { transform: scaleX(1) scaleY(1); opacity: 0.65; }
    }
    .ba-star {
      position: absolute; border-radius: 50%; background: #ffffff;
      box-shadow: 0 0 6px #00e5ff, 0 0 12px rgba(0, 229, 255, 0.8);
      opacity: 0.3;
    }
    .ba-st1 { top: 7%;  left: 11%; width: 3px; height: 3px; animation: ba-star-twinkle 3.2s ease-in-out 0.2s infinite alternate; }
    .ba-st2 { top: 15%; left: 24%; width: 2px; height: 2px; animation: ba-star-twinkle 4.5s ease-in-out 1.5s infinite alternate; }
    .ba-st3 { top: 5%;  left: 39%; width: 4px; height: 4px; box-shadow: 0 0 8px #00e5ff, 0 0 16px #ffffff; animation: ba-star-twinkle 3.8s ease-in-out 2.1s infinite alternate; }
    .ba-st4 { top: 19%; left: 56%; width: 2px; height: 2px; animation: ba-star-twinkle 4.1s ease-in-out 0.8s infinite alternate; }
    .ba-st5 { top: 8%;  left: 72%; width: 3px; height: 3px; animation: ba-star-twinkle 3.5s ease-in-out 3s infinite alternate; }
    .ba-st6 { top: 22%; left: 83%; width: 2px; height: 2px; animation: ba-star-twinkle 4.8s ease-in-out 1.2s infinite alternate; }
    .ba-st7 { top: 11%; left: 92%; width: 4px; height: 4px; box-shadow: 0 0 8px #00e5ff, 0 0 16px #ffffff; animation: ba-star-twinkle 3.6s ease-in-out 2.7s infinite alternate; }
    .ba-st8 { top: 25%; left: 33%; width: 2px; height: 2px; animation: ba-star-twinkle 5s ease-in-out 0.5s infinite alternate; }
    @keyframes ba-star-twinkle {
      0%   { opacity: 0.2; transform: scale(0.7); }
      100% { opacity: 1;   transform: scale(1.4); }
    }
    .ba-meteor {
      position: absolute; height: 2px;
      background: linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.3) 30%, #00e5ff 75%, #ffffff 100%);
      border-radius: 2px;
      box-shadow: 0 0 10px #00e5ff, 0 0 20px rgba(0, 229, 255, 0.7);
      opacity: 0;
    }
    .ba-m1 {
      top: 10%; right: 22%; width: 140px;
      animation: ba-meteor-1 7.5s ease-in-out 1s infinite;
    }
    .ba-m2 {
      top: 6%; right: 48%; width: 110px;
      animation: ba-meteor-2 10.5s ease-in-out 4.8s infinite;
    }
    @keyframes ba-meteor-1 {
      0%, 86%  { transform: translate(0, 0) rotate(-32deg); opacity: 0; }
      87%      { opacity: 0.95; }
      90%      { transform: translate(-260px, 160px) rotate(-32deg); opacity: 0; }
      100%     { opacity: 0; }
    }
    @keyframes ba-meteor-2 {
      0%, 88%  { transform: translate(0, 0) rotate(-28deg); opacity: 0; }
      89%      { opacity: 0.9; }
      92%      { transform: translate(-220px, 120px) rotate(-28deg); opacity: 0; }
      100%     { opacity: 0; }
    }

    /* --- green: Тактические матричные потоки (чистый киберпанк БЕЗ рамок и горизонтальных линий) --- */
    .ba-matrix-col {
      position: absolute; top: 0; width: 2px; height: 180px;
      background: linear-gradient(180deg, transparent 0%, rgba(0, 255, 136, 0.25) 30%, #00ff88 85%, #ffffff 100%);
      box-shadow: 0 0 8px #00ff88, 0 0 16px rgba(0, 255, 136, 0.4);
      opacity: 0;
    }
    .ba-mc1 { left: 4%;  animation: ba-matrix-stream 4.8s linear 0.5s infinite; }
    .ba-mc2 { left: 12%; animation: ba-matrix-stream 6.2s linear 2.5s infinite; }
    .ba-mc3 { right: 12%; animation: ba-matrix-stream 5.5s linear 1.2s infinite; }
    .ba-mc4 { right: 4%;  animation: ba-matrix-stream 6.8s linear 3.8s infinite; }
    @keyframes ba-matrix-stream {
      0%   { transform: translateY(-100%); opacity: 0; }
      20%  { opacity: 0.85; }
      80%  { opacity: 0.85; }
      100% { transform: translateY(95vh); opacity: 0; }
    }

    /* --- grey: Универсальная кинематографичная атмосфера — парящие перья, звёздный пепел, лунный туман и блики клинков --- */
    .ba-grey-mist {
      position: absolute; top: 0; left: 0; right: 0; height: 320px;
      background: radial-gradient(ellipse 70% 160px at 50% 0%, rgba(255, 255, 255, 0.08) 0%, rgba(200, 215, 235, 0.02) 60%, transparent 100%);
      filter: blur(14px);
      pointer-events: none;
      animation: ba-grey-mist-breathe 9s ease-in-out infinite alternate;
    }
    @keyframes ba-grey-mist-breathe {
      0%   { opacity: 0.45; transform: scaleX(0.95) scaleY(0.9); }
      50%  { opacity: 0.85; transform: scaleX(1.05) scaleY(1.15); }
      100% { opacity: 0.6;  transform: scaleX(1) scaleY(1); }
    }

    /* Эфирные парящие перья (Sephiroth One-Winged Angel / ворон самураев) */
    .ba-feather {
      position: absolute; top: -60px;
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.7)) drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
      opacity: 0; pointer-events: none;
    }
    .ba-f1 {
      left: 15%; width: 20px; height: 52px;
      animation: ba-feather-fall-1 14s linear 0s infinite;
    }
    .ba-f2 {
      left: 72%; width: 24px; height: 62px;
      animation: ba-feather-fall-2 17s linear 4.5s infinite;
    }
    .ba-f3 {
      left: 42%; width: 17px; height: 45px;
      animation: ba-feather-fall-1 15.5s linear 8.5s infinite;
    }
    @keyframes ba-feather-fall-1 {
      0%   { transform: translateY(-40px) translateX(0) rotate(12deg) rotateY(0deg); opacity: 0; }
      12%  { opacity: 0.85; }
      85%  { opacity: 0.75; }
      100% { transform: translateY(105vh) translateX(85px) rotate(260deg) rotateY(180deg); opacity: 0; }
    }
    @keyframes ba-feather-fall-2 {
      0%   { transform: translateY(-40px) translateX(0) rotate(-16deg) rotateY(0deg); opacity: 0; }
      10%  { opacity: 0.8; }
      85%  { opacity: 0.7; }
      100% { transform: translateY(105vh) translateX(-75px) rotate(-280deg) rotateY(180deg); opacity: 0; }
    }

    /* Серебряные искры и хлопья пепла */
    .ba-ash {
      position: absolute; top: -20px;
      background: radial-gradient(circle, #ffffff 20%, rgba(220, 230, 245, 0.85) 50%, rgba(140, 155, 175, 0) 100%);
      border-radius: 50%;
      box-shadow: 0 0 6px rgba(255, 255, 255, 0.85), 0 0 14px rgba(180, 200, 225, 0.5);
      opacity: 0; pointer-events: none;
    }
    .ba-a1 { left: 9%;  width: 5px; height: 5px; animation: ba-ash-fall 9.5s linear 0s infinite; }
    .ba-a2 { left: 22%; width: 3px; height: 3px; animation: ba-ash-fall 12.5s linear 2.5s infinite; }
    .ba-a3 { left: 33%; width: 6px; height: 6px; animation: ba-ash-fall 8.8s linear 4.8s infinite; }
    .ba-a4 { left: 48%; width: 4px; height: 4px; animation: ba-ash-fall 11.2s linear 1.2s infinite; }
    .ba-a5 { left: 63%; width: 5px; height: 5px; animation: ba-ash-fall 9.8s linear 3.7s infinite; }
    .ba-a6 { left: 79%; width: 3px; height: 3px; animation: ba-ash-fall 13.5s linear 6.2s infinite; }
    .ba-a7 { left: 89%; width: 6px; height: 6px; animation: ba-ash-fall 8.2s linear 2s infinite; }
    .ba-a8 { left: 96%; width: 4px; height: 4px; animation: ba-ash-fall 10.8s linear 5s infinite; }
    @keyframes ba-ash-fall {
      0%   { transform: translateY(-20px) translateX(0) rotate(0deg); opacity: 0; }
      15%  { opacity: 0.9; }
      80%  { opacity: 0.8; }
      100% { transform: translateY(105vh) translateX(55px) rotate(180deg); opacity: 0; }
    }

    /* Вспышки бликов лезвий и анаморфотные лучи (кинематографичный отблеск стали) */
    .ba-flare {
      position: absolute; display: flex; align-items: center; justify-content: center;
      pointer-events: none; opacity: 0;
    }
    .ba-fl-1 {
      top: 34%; left: 22%;
      animation: ba-flare-sparkle-1 8.5s ease-in-out 1.5s infinite;
    }
    .ba-fl-2 {
      top: 40%; right: 24%;
      animation: ba-flare-sparkle-2 10.5s ease-in-out 5.8s infinite;
    }
    .ba-flare-spark {
      width: 6px; height: 6px; background: #ffffff; border-radius: 50%;
      box-shadow: 0 0 6px #ffffff, 0 0 16px rgba(255, 255, 255, 0.95), 0 0 35px rgba(200, 220, 255, 0.7);
    }
    .ba-flare-ray {
      position: absolute; width: 130px; height: 1.5px;
      background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 20%, #ffffff 50%, rgba(255, 255, 255, 0.4) 80%, transparent 100%);
      box-shadow: 0 0 8px #ffffff;
    }
    @keyframes ba-flare-sparkle-1 {
      0%, 88%    { transform: scale(0.2) rotate(0deg); opacity: 0; }
      90%        { transform: scale(1.2) rotate(45deg); opacity: 1; }
      92%        { transform: scale(1) rotate(90deg); opacity: 0.9; }
      95%        { transform: scale(0.4) rotate(135deg); opacity: 0.2; }
      97%, 100%  { transform: scale(0.1); opacity: 0; }
    }
    @keyframes ba-flare-sparkle-2 {
      0%, 88%    { transform: scale(0.2) rotate(0deg); opacity: 0; }
      90%        { transform: scale(1.2) rotate(-45deg); opacity: 1; }
      92%        { transform: scale(1) rotate(-90deg); opacity: 0.9; }
      95%        { transform: scale(0.4) rotate(-135deg); opacity: 0.2; }
      97%, 100%  { transform: scale(0.1); opacity: 0; }
    }

    /* --- purple: Ретро-синтвейв туман горизонта и парящие неоновые частицы --- */
    .ba-synth-mist {
      position: absolute; top: 0; left: 0; right: 0; height: 260px;
      background: radial-gradient(ellipse 75% 140px at 50% 0%, rgba(180, 75, 255, 0.14) 0%, rgba(208, 117, 255, 0.05) 55%, transparent 100%);
      filter: blur(14px);
      pointer-events: none;
      animation: ba-synth-mist-pulse 8s ease-in-out infinite alternate;
    }
    @keyframes ba-synth-mist-pulse {
      0%   { opacity: 0.5; transform: scale(0.98); }
      100% { opacity: 0.9; transform: scale(1.02); }
    }
    .ba-synth-mote {
      position: absolute; bottom: 0; border-radius: 50%;
      background: radial-gradient(circle, #ffffff 15%, #d075ff 60%, #b44bff 100%);
      box-shadow: 0 0 8px #b44bff, 0 0 18px rgba(180, 75, 255, 0.65);
      opacity: 0; pointer-events: none;
    }
    .ba-sm1 { left: 14%; width: 4px; height: 4px; animation: ba-synth-up 8s ease-out 0.5s infinite; }
    .ba-sm2 { left: 28%; width: 5px; height: 5px; animation: ba-synth-up 10s ease-out 3s infinite; }
    .ba-sm3 { left: 45%; width: 3px; height: 3px; animation: ba-synth-up 7.5s ease-out 1.2s infinite; }
    .ba-sm4 { left: 65%; width: 4px; height: 4px; animation: ba-synth-up 9s ease-out 1.5s infinite; }
    .ba-sm5 { left: 82%; width: 5px; height: 5px; animation: ba-synth-up 8.5s ease-out 4.5s infinite; }
    .ba-sm6 { left: 92%; width: 3px; height: 3px; animation: ba-synth-up 11s ease-out 2s infinite; }
    @keyframes ba-synth-up {
      0%   { transform: translateY(0) translateX(0); opacity: 0; }
      15%  { opacity: 0.85; }
      70%  { opacity: 0.7; }
      100% { transform: translateY(-75vh) translateX(30px); opacity: 0; }
    }

    /* --- red / custom: Алые искры клинка AVA 3.0 (БЕЗ уголков) --- */
    .ba-red-mote {
      position: absolute; bottom: 0; border-radius: 50%;
      background: radial-gradient(circle, #ffffff 15%, color-mix(in srgb, var(--accent, #ff2a2a) 80%, #fff) 50%, var(--accent, #ff2a2a) 100%);
      box-shadow: 0 0 8px var(--accent, #ff2a2a), 0 0 16px color-mix(in srgb, var(--accent, #ff2a2a) 50%, transparent);
      opacity: 0;
    }
    .ba-rm1 { left: 16%; width: 4px; height: 4px; animation: ba-red-up 8.5s ease-out 0s infinite; }
    .ba-rm2 { left: 32%; width: 5px; height: 5px; animation: ba-red-up 10.5s ease-out 2.5s infinite; }
    .ba-rm3 { left: 70%; width: 4px; height: 4px; animation: ba-red-up 9s ease-out 1s infinite; }
    .ba-rm4 { left: 85%; width: 5px; height: 5px; animation: ba-red-up 8s ease-out 4s infinite; }
    @keyframes ba-red-up {
      0%   { transform: translateY(0) translateX(0); opacity: 0; }
      15%  { opacity: 0.85; }
      70%  { opacity: 0.65; }
      100% { transform: translateY(-70vh) translateX(30px); opacity: 0; }
    }
  `;

  try {
    const doc = window.document;
    // НЕ в tabbrowser-tabpanels: XUL deck рисует только выбранный panel,
    // остальные дети невидимы. #browser — обычный hbox, рендерит всех.
    const deck = doc.getElementById('browser');
    if (!deck) throw new Error('нет #browser');

    const st = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
    st.textContent = HERO_CSS;
    doc.documentElement.appendChild(st);

    const wrap = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    wrap.id = 'blade-hero-wrap';
    wrap.innerHTML =
      '<div id="blade-atmosphere" aria-hidden="true">' +
        '<div class="ba-blood">' +
          '<div class="ba-blood-mist"></div>' +
          '<svg class="ba-blood-arc" viewBox="0 0 320 180" fill="none"><path d="M 20 160 Q 150 70 300 20"/></svg>' +
          '<div class="ba-blood-flash"></div>' +
          '<div class="ba-blood-mote ba-bm1"></div><div class="ba-blood-mote ba-bm2"></div>' +
          '<div class="ba-blood-mote ba-bm3"></div><div class="ba-blood-mote ba-bm4"></div>' +
        '</div>' +
        '<div class="ba-volt">' +
          '<svg class="ba-lightning" viewBox="0 0 160 320" fill="none"><path d="M110 0 L70 100 L100 110 L50 210 L80 215 L20 320"/></svg>' +
          '<div class="ba-lightning-flash"></div>' +
        '</div>' +
        '<div class="ba-cherry">' +
          '<div class="ba-petal ba-p1"></div><div class="ba-petal ba-p2"></div><div class="ba-petal ba-p3"></div>' +
          '<div class="ba-petal ba-p4"></div><div class="ba-petal ba-p5"></div><div class="ba-petal ba-p6"></div><div class="ba-petal ba-p7"></div>' +
        '</div>' +
        '<div class="ba-orange">' +
          '<div class="ba-ember ba-e1"></div><div class="ba-ember ba-e2"></div><div class="ba-ember ba-e3"></div>' +
          '<div class="ba-ember ba-e4"></div><div class="ba-ember ba-e5"></div><div class="ba-ember ba-e6"></div>' +
        '</div>' +
        '<div class="ba-midnight">' +
          '<div class="ba-aurora-ribbon"></div>' +
          '<div class="ba-star ba-st1"></div><div class="ba-star ba-st2"></div><div class="ba-star ba-st3"></div><div class="ba-star ba-st4"></div>' +
          '<div class="ba-star ba-st5"></div><div class="ba-star ba-st6"></div><div class="ba-star ba-st7"></div><div class="ba-star ba-st8"></div>' +
          '<div class="ba-meteor ba-m1"></div><div class="ba-meteor ba-m2"></div>' +
        '</div>' +
        '<div class="ba-green">' +
          '<div class="ba-matrix-col ba-mc1"></div><div class="ba-matrix-col ba-mc2"></div>' +
          '<div class="ba-matrix-col ba-mc3"></div><div class="ba-matrix-col ba-mc4"></div>' +
        '</div>' +
        '<div class="ba-grey">' +
          '<div class="ba-grey-mist"></div>' +
          '<svg class="ba-feather ba-f1" viewBox="0 0 24 64" fill="none"><path d="M12 2 C6 18 3 42 12 62 C21 42 18 18 12 2 Z" fill="rgba(235,242,250,0.65)"/><path d="M12 4 L12 60" stroke="#ffffff" stroke-width="0.8"/></svg>' +
          '<svg class="ba-feather ba-f2" viewBox="0 0 24 64" fill="none"><path d="M12 2 C6 18 3 42 12 62 C21 42 18 18 12 2 Z" fill="rgba(215,225,240,0.6)"/><path d="M12 4 L12 60" stroke="#ffffff" stroke-width="0.8"/></svg>' +
          '<svg class="ba-feather ba-f3" viewBox="0 0 24 64" fill="none"><path d="M12 2 C6 18 3 42 12 62 C21 42 18 18 12 2 Z" fill="rgba(235,242,250,0.55)"/><path d="M12 4 L12 60" stroke="#ffffff" stroke-width="0.8"/></svg>' +
          '<div class="ba-ash ba-a1"></div><div class="ba-ash ba-a2"></div><div class="ba-ash ba-a3"></div>' +
          '<div class="ba-ash ba-a4"></div><div class="ba-ash ba-a5"></div><div class="ba-ash ba-a6"></div>' +
          '<div class="ba-ash ba-a7"></div><div class="ba-ash ba-a8"></div>' +
          '<div class="ba-flare ba-fl-1"><div class="ba-flare-spark"></div><div class="ba-flare-ray"></div></div>' +
          '<div class="ba-flare ba-fl-2"><div class="ba-flare-spark"></div><div class="ba-flare-ray"></div></div>' +
        '</div>' +
        '<div class="ba-purple">' +
          '<div class="ba-synth-mist"></div>' +
          '<div class="ba-synth-mote ba-sm1"></div><div class="ba-synth-mote ba-sm2"></div>' +
          '<div class="ba-synth-mote ba-sm3"></div><div class="ba-synth-mote ba-sm4"></div>' +
          '<div class="ba-synth-mote ba-sm5"></div><div class="ba-synth-mote ba-sm6"></div>' +
        '</div>' +
        '<div class="ba-red">' +
          '<div class="ba-red-mote ba-rm1"></div><div class="ba-red-mote ba-rm2"></div>' +
          '<div class="ba-red-mote ba-rm3"></div><div class="ba-red-mote ba-rm4"></div>' +
        '</div>' +
      '</div>' +
      '<div id="blade-hero" role="banner" aria-label="AVA 3.0 Hero" data-state="success">' +
        '<div class="bh-greet" role="heading" aria-level="2"></div>' +
        '<div class="bh-clock" role="timer" aria-live="off" aria-label="--:--:--">' +
          '<span class="bh-hm">--:--</span><span class="bh-sec">--</span>' +
        '</div>' +
        '<div class="bh-accent-line" aria-hidden="true"><span class="bh-accent-core"></span></div>' +
        '<div class="bh-date"></div>' +
        '<div class="bh-status" role="status" aria-live="polite">BLADE OS // ONLINE</div>' +
      '</div>';
    deck.appendChild(wrap);

    const clockEl = wrap.querySelector('.bh-clock');
    const hm = wrap.querySelector('.bh-hm');
    const sec = wrap.querySelector('.bh-sec');
    const dateEl = wrap.querySelector('.bh-date');
    const status = wrap.querySelector('.bh-status');
    const greetEl = wrap.querySelector('.bh-greet');

    // --- Погода/город из кэша BladeClock (префы) ---
    function getStr(name) {
      try { return Services.prefs.getStringPref(name, ''); } catch (e) { return ''; }
    }
    // data != null — пришло живьём из шины clock:weather, иначе читаем префы
    function refreshWeather(data) {
      try {
        let weather = '', city = '';
        if (data) {
          weather = data.weather || '';
          city = data.city || '';
        } else {
          weather = getStr('blade.clock.weather');
          city = getStr('blade.clock.city');
        }
        const part = weather ? (city ? city + ' ' : '') + weather : '';
        const text = part ? 'BLADE OS // ONLINE  ·  ' + part : 'BLADE OS // ONLINE';
        if (status.textContent !== text) status.textContent = text;
      } catch (e) {}
    }
    refreshWeather();

    // --- Приветствие по часу: обновляется в минутной ветке tick() ---
    function greetText(h) {
      if (h >= 5 && h < 11) return 'Доброе утро';
      if (h >= 11 && h < 17) return 'Добрый день';
      if (h >= 17 && h < 23) return 'Добрый вечер';
      return 'Доброй ночи';
    }

    // Тик дешевле: DOM трогаем только когда hero виден (класс blade-on),
    // дату — не чаще раза в минуту (день меняется редко)
    let lastMinute = -1;
    function tick() {
      try {
        if (!wrap.classList.contains('blade-on')) return;
        const d = new Date();
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        const hmStr = h + ':' + m;
        const secStr = String(d.getSeconds()).padStart(2, '0');
        if (hm && hm.textContent !== hmStr) hm.textContent = hmStr;
        if (sec && sec.textContent !== secStr) sec.textContent = secStr;
        if (clockEl) clockEl.setAttribute('aria-label', hmStr + ':' + secStr);
        if (d.getMinutes() !== lastMinute) {
          lastMinute = d.getMinutes();
          dateEl.textContent = d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
          const g = greetText(d.getHours());
          if (greetEl.textContent !== g) greetEl.textContent = g;
        }
      } catch (e) {}
    }
    tick();
    // Тик через реестр BladeCore — снятие на unload автоматом (2.0)
    if (window.Blade && window.Blade.every) Blade.every(tick, 1000);
    else window.setInterval(tick, 1000);

    function updateVisible() {
      try {
        const u = window.gBrowser.currentURI ? window.gBrowser.currentURI.spec : '';
        wrap.classList.toggle('blade-on', /^about:(newtab|home)/.test(u));
        // hero только что показался — рисуем сразу, не ждём следующего тика
        if (wrap.classList.contains('blade-on')) {
          tick();
          refreshWeather();   // префы могли обновиться, пока hero был скрыт
        }
      } catch (e) {}
    }
    const progListener = { onLocationChange() { updateVisible(); } };
    window.gBrowser.addTabsProgressListener(progListener);
    window.gBrowser.tabContainer.addEventListener('TabSelect', updateVisible);

    // --- Тикер хроники: строка 1 (заголовок) + первая непустая после неё ---
    try {
      const f = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
      f.append('JS'); f.append('update_chronicle.txt');
      IOUtils.readUTF8(f.path).then(text => {
        try {
          const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
          const title = (lines[0] || '').trim();
          if (!title) return;
          let detail = '';
          for (let i = 1; i < lines.length; i++) {
            const ln = lines[i].trim();
            if (ln) { detail = ln; break; }
          }
          if (!detail) return;
          const el = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
          el.id = 'blade-hero-chronicle';
          el.textContent = title + ' — ' + detail;
          wrap.appendChild(el);
        } catch (e) {}
      }).catch(() => {});
    } catch (e) {}

    // --- Живая погода из BladeClock через шину (fail-soft, если шины нет) ---
    let busHandler = null;
    try {
      if (window.Blade && window.Blade.bus) {
        busHandler = (data) => refreshWeather(data);
        window.Blade.bus.on('clock:weather', busHandler);
      }
    } catch (e) {}

    window.addEventListener('unload', () => {
      try { window.gBrowser.removeTabsProgressListener(progListener); } catch (e) {}
      try {
        if (busHandler && window.Blade && window.Blade.bus)
          window.Blade.bus.off('clock:weather', busHandler);
      } catch (e) {}
    }, { once: true });

    updateVisible();
    mark('OK overlay');
  } catch (e) { mark('ERR start', e); }

  window.BladeNewtabHero = true;
})();
