// ==UserScript==
// @name            Blade Theme Lab
// @description     Конструктор своей темы: HSL-слайдеры + hex + живое превью.
//                  Шаг 5 декомпозиции BobliksSettings — здесь только UI диалога;
//                  цветную математику и применение берёт из window.BladeSettings
// @author          Blade-Creations
// @include         main
// @version         1.0.0
// @loadOrder       12
// ==/UserScript==
(function () {
  if (window.BladeThemeLab) return;
  window.BladeThemeLab = true;

  let markPath = '';
  try {
    const d = Services.dirsvc.get('UChrm', Ci.nsIFile).clone();
    d.append('JS');
    markPath = d.path + '\\BladeThemeLab_mark.txt';
  } catch (e) {}
  const mark = (m, e) => {
    try {
      if (!markPath) return;
      const text = 'v1.0.0 ' + m + (e ? '\n' + String(e) + '\n' + (e && e.stack || '') : '');
      IOUtils.writeUTF8(markPath, text).catch(() => {});
    } catch (e2) {}
  };

  // Диалог вынесен из монолита (строки 386–577 до выноса). Цветная математика
  // (customVars/hexToRgb/applyCustomToDoc) остаётся в BobliksSettings и шагом 7
  // уедёт в BladeThemeEngine — здесь UI не дублирует формулы, а зовёт их по API.
  function openThemeLab() {
    const api = window.BladeSettings;
    if (!api || !api.customVars || !api.hexToRgb || !api.applyCustomToDoc ||
        !api.applyLiveAttrs || !api.getCustomColor || !api.setTheme) {
      mark('NO_API');
      return;
    }
    try {
      const dlg = window.openDialog('about:blank', 'blade-theme-lab',
        'chrome,centerscreen,dialog=no,width=470,height=520,resizable=no');
      // закрыли крестиком без «Применить» — откат живых изменений к сохранённым.
      // 'close' есть у chrome-окон, 'unload' — гарантированный общий случай:
      // вешаем оба, applyLiveAttrs идемпотентен (Gemini ревью-2, баг 1)
      const onLabClose = () => { try { api.applyLiveAttrs(); } catch (e) {} };
      dlg.addEventListener('close', onLabClose);
      dlg.addEventListener('unload', onLabClose);
      // about:blank грузится мгновенно: load может стрельнуть ДО подписки —
      // строим идемпотентно, кто первый (load или таймаут), тот и построил
      let built = false;
      const build = () => {
        if (built) return;
        built = true;
        try {
          const d = dlg.document;
          d.title = 'Конструктор темы Blade';
          const st = d.createElement('style');
          st.textContent = [
            // !important: userChrome.css красит body chrome-диалогов акцентом
            // рамки — перебиваем (скриншот-аудит Gemini раунд 3)
            'html, body { background: #0a0a0c !important; color: #e8e8e8 !important; font: 13px/1.5 system-ui, sans-serif; margin: 0; }',
            '.wrap { padding: 18px 22px; min-height: 100vh; box-sizing: border-box; }',
            'h1 { color: #ff2a2a; font-size: 15px; letter-spacing: 3px; margin: 0 0 14px; }',
            '.row { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }',
            '.cur { width: 52px; height: 52px; border-radius: 12px; border: 1px solid #2a2a34; box-shadow: 0 0 16px rgba(255,42,42,.25); }',
            '#hexin, input[type=text] { background: #14141a; color: #e8e8e8; border: 1px solid #2a2a34; border-radius: 8px; padding: 8px 10px; font-family: monospace; font-size: 14px; width: 96px; }',
            '.hint { color: #8a8f98; }',
            '.slider { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }',
            '.slider label { width: 108px; color: #b8b8c0; }',
            '.slider input { flex: 1; }',
            '.slider output { width: 34px; text-align: right; color: #8a8f98; font-family: monospace; }',
            'input[type=range] { appearance: none; height: 10px; border-radius: 6px; background: #1a1a22; border: 1px solid #2a2a34; padding: 0; margin: 0; }',
            '.hue-slider { background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00) !important; border: none !important; }',
            'input[type=range]::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #e8e8e8; border: 2px solid #0a0a0c; box-shadow: 0 0 8px rgba(255,42,42,.7); }',
            '.swatches { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 16px; }',
            '.sw { width: 26px; height: 26px; border-radius: 8px; border: 1px solid #2a2a34; cursor: pointer; }',
            '.sw:hover { transform: scale(1.16); }',
            '.preview { border-radius: 10px; padding: 16px; margin-bottom: 16px; border: 1px solid #2a2a34; transition: background .15s; }',
            '.pbtn { display: inline-block; padding: 6px 14px; border-radius: 8px; margin-right: 8px; font-weight: 700; transition: all .15s; }',
            '.ptile { display: inline-block; width: 64px; height: 44px; border-radius: 8px; margin-right: 8px; vertical-align: middle; }',
            '.btns { display: flex; gap: 10px; }',
            'button { flex: 1; padding: 9px 0; border-radius: 8px; font-weight: 700; cursor: pointer; border: 1px solid #2a2a34; }',
            '#apply { background: #ff2a2a; color: #fff; border: none; }',
            '#apply:hover { filter: brightness(1.15); }',
            '#reset { background: #14141a; color: #e8e8e8; }'
          ].join('\n');
          d.head.appendChild(st);
          // Статичный каркас — innerHTML (div/span в chrome-документе ок),
          // интерактивные контролы — createElement: input из innerHTML
          // в chrome-доке теряет id (диагностировано)
          d.body.innerHTML = '<div class="wrap">' +
            '<h1>⚡ СВОЯ ТЕМА</h1>' +
            '<div class="row"><div class="cur" id="cur"></div>' +
            '<div><div style="margin-bottom:6px" id="hexbox"></div>' +
            '<div class="hint">крути слайдеры — тема соберётся сама</div></div></div>' +
            '<div id="sliders"></div>' +
            '<div class="swatches" id="sw"></div>' +
            '<div class="preview" id="pv"><span class="ptile" id="ptile"></span>' +
            '<span class="pbtn" id="pbtn">Кнопка</span>' +
            '<span> Текст · <span id="paccent">акцент</span></span></div>' +
            '<div class="btns" id="btnbox"></div></div>';

          function sliderRow(labelText, min, max) {
            const row = d.createElement('div');
            row.className = 'slider';
            const lab = d.createElement('label');
            lab.textContent = labelText;
            const inp = d.createElement('input');
            inp.type = 'range'; inp.min = min; inp.max = max; inp.step = 1;
            const out = d.createElement('output');
            row.append(lab, inp, out);
            d.getElementById('sliders').appendChild(row);
            return { inp, out };
          }
          const hueS = sliderRow('Оттенок', 0, 360);
          const satS = sliderRow('Насыщенность', 30, 100);
          const ligS = sliderRow('Яркость', 35, 75);
          const hueEl = hueS.inp, satEl = satS.inp, ligEl = ligS.inp;
          const hueO = hueS.out, satO = satS.out, ligO = ligS.out;
          hueEl.className = 'hue-slider';

          const hexIn = d.createElement('input');
          hexIn.type = 'text';
          hexIn.value = '#ff2a2a';
          d.getElementById('hexbox').appendChild(hexIn);

          const applyB = d.createElement('button');
          applyB.id = 'apply';
          applyB.textContent = 'Применить';
          const resetB = d.createElement('button');
          resetB.id = 'reset';
          resetB.textContent = 'Вернуть GX Red';
          d.getElementById('btnbox').append(resetB, applyB);

          function hslToHex(h, s, l) {
            s /= 100; l /= 100;
            const k = n => (n + h / 30) % 12;
            const a = s * Math.min(l, 1 - l);
            const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
            const to = x => Math.round(255 * x).toString(16).padStart(2, '0');
            return '#' + to(f(0)) + to(f(8)) + to(f(4));
          }
          function hexToHsl(hex) {
            const rgb = api.hexToRgb(hex).map(x => x / 255);
            const mx = Math.max(rgb[0], rgb[1], rgb[2]), mn = Math.min(rgb[0], rgb[1], rgb[2]);
            let h = 0, s = 0;
            const l = (mx + mn) / 2;
            if (mx !== mn) {
              const dd = mx - mn;
              s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
              if (mx === rgb[0]) h = ((rgb[1] - rgb[2]) / dd + 6) % 6;
              else if (mx === rgb[1]) h = (rgb[2] - rgb[0]) / dd + 2;
              else h = (rgb[0] - rgb[1]) / dd + 4;
              h *= 60;
            }
            return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
          }

          function currentHex() {
            return hslToHex(Number(hueEl.value), Number(satEl.value), Number(ligEl.value));
          }
          function render() {
            const hex = currentHex();
            const v = api.customVars(hex);
            d.getElementById('cur').style.background = hex;
            d.getElementById('cur').style.boxShadow = '0 0 16px ' + v['--accent-soft'];
            if (d.activeElement !== hexIn) hexIn.value = hex;
            hueO.value = hueEl.value;
            satO.value = satEl.value + '%';
            ligO.value = ligEl.value + '%';
            d.getElementById('pv').style.background = v['--bg'];
            const pb = d.getElementById('pbtn');
            pb.style.background = hex;
            pb.style.color = api.customVars._selText;
            pb.style.boxShadow = '0 0 14px ' + v['--accent-soft'];
            const tile = d.getElementById('ptile');
            tile.style.background = v['--panel'];
            tile.style.border = '1px solid ' + hex;
            d.getElementById('paccent').style.color = hex;
            // Живое применение: браузер перекрашивается прямо при движении
            // слайдера (Gemini №2.5). Не сохранили и закрыли — applyLiveAttrs
            // вернёт сохранённое состояние.
            api.applyCustomToDoc(window.document, hex);
          }
          function setHex(hex) {
            const hsl = hexToHsl(hex);
            hueEl.value = hsl.h; satEl.value = hsl.s; ligEl.value = hsl.l;
            render();
          }

          for (const el of [hueEl, satEl, ligEl]) el.addEventListener('input', render);
          hexIn.addEventListener('input', () => {
            if (/^#[0-9a-f]{6}$/i.test(hexIn.value.trim())) {
              setHex(hexIn.value.trim());
            }
          });
          const presets = ['#ff2a2a', '#ff6a1f', '#fff820', '#00ff88', '#2f6bff', '#b44bff', '#ff2a78', '#00e5ff'];
          for (const c of presets) {
            const s = d.createElement('span');
            s.className = 'sw';
            s.style.background = c;
            s.addEventListener('click', () => setHex(c));
            d.getElementById('sw').appendChild(s);
          }
          applyB.addEventListener('click', () => {
            Services.prefs.setStringPref('blade.theme.customColor', currentHex());
            // Цвет кастомной темы запекается в covers.css (тематизация
            // сайтов) — дергаем тумблер перегенерации для BobliksCovers
            try {
              Services.prefs.setBoolPref('bobliks.covers.dirty', !Services.prefs.getBoolPref('bobliks.covers.dirty', false));
            } catch (e) {}
            api.setTheme('custom');
            api.applyLiveAttrs();
            dlg.close();
          });
          resetB.addEventListener('click', () => {
            api.setTheme('red');
            api.applyLiveAttrs();
            dlg.close();
          });
          setHex(api.getCustomColor());
        } catch (e) { mark('ERR lab build ' + e); }
      };
      dlg.addEventListener('load', build, { once: true });
      setTimeout(build, 250);
    } catch (e) { mark('ERR lab ' + e); }
  }

  mark('START');

  window.BladeThemeLab = { open: openThemeLab };

  mark('OK lab');
})();
