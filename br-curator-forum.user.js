// ==UserScript==
// @name         BR | Кураторы форума — автопроверка (РП био / ситуации / неоф. орг)
// @namespace    br-curator-khabarovsk
// @version      5.5.0
// @description  Проверяет темы по правилам разделов, готовит ответ (одобрено / отказ / доработка), ставит префикс, закрывает или закрепляет тему
// @match        https://forum.blackrussia.online/*
// @updateURL    https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js
// @downloadURL  https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js
// @note         5.5.0 — тема оформления всего форума (вкл/выкл в настройках)
// @note         5.4.2 — пункты формы ищутся без обязательного двоеточия; ник сравнивается по согласным (Ded_Bomer = Дед Бумер)
// @note         5.4.1 — статус обновлений сохраняется между страницами
// @note         5.4.0 — причины отказа подбираются автоматически и по подозрениям (метка «авто»)
// @note         5.3.1 — имя вместо ника в заголовке био: предупреждение, а не нарушение; кэш сбрасывается при обновлении
// @note         5.3.0 — новый дизайн панели проверки: единые иконки, рекомендуемое действие, списки замечаний; вторая одобренная био — предупреждение, а не нарушение
// @note         5.2.2 — компактное меню со вкладками
// @note         5.2.1 — верные ID префиксов по умолчанию (8/4/2), точные адреса разделов
// @note         5.2.0 — после вердикта тема переносится в подраздел (Одобренные / Неодобренные / На доработке)
// @note         5.1.0 — шпаргалка правил с поиском, своя подпись в ответах
// @note         5.0.2 — ID префиксов берутся из формы редактирования темы и подразделов; честная ошибка в очереди
// @note         5.0.1 — ID префиксов определяются автоматически, видны в меню
// @note         5.0.0 — кнопка «Следующая тема», счётчик просроченных на иконке, предпросмотр ответа, проверка OOC, контроль отчётов неоф. орг, общие причины команды
// @note         4.1.0 — новое меню: статус обновлений, настройки (мгновенная отправка, таймеры, свёрнутая панель), сброс кэша
// @note         4.0.2 — фото по ссылке текстом засчитываются, фикс иконки
// @note         4.0.1 — новая иконка настроек, фикс дублей и таймера на рассмотренных темах
// @note         4.0.0 — поиск копипаста и дублей, очередь с таймерами в разделах, контроль доработки 24ч, свои причины, подсветка в тексте
// @note         3.2.0 — новый дизайн панели, починены ложные срабатывания (заголовок, имя, фото)
// @note         3.1.0 — плавающая кнопка: проверка и установка обновлений
// @note         3.0.0 — проверки под правила разделов Хабаровска
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  /* ===================== ТЕМА ФОРУМА (грузится сразу, без мигания) ===================== */
  const THEME_CSS = `
    html.brc-theme{--bt-bg:#0c1113;--bt-card:#141b1e;--bt-card2:#192225;--bt-line:#ffffff10;--bt-txt:#e6edf0;--bt-mut:#8796a0;--bt-acc:#40c4d3;--bt-acc2:#22c58b}
    html.brc-theme body,html.brc-theme .p-pageWrapper,html.brc-theme .p-body{background:var(--bt-bg)!important}
    html.brc-theme .p-header,html.brc-theme .p-navSticky,html.brc-theme .p-nav,html.brc-theme .p-sectionLinks,html.brc-theme .p-staffBar{
      background:#10171a!important;border-color:var(--bt-line)!important;box-shadow:0 1px 0 #ffffff08,0 8px 24px -12px #000c!important}
    html.brc-theme .p-body-header{background:transparent!important}
    html.brc-theme .p-title-value{font-weight:800!important;letter-spacing:-.015em}
    html.brc-theme .p-description,html.brc-theme .p-body-header .p-description{color:var(--bt-mut)!important}
    html.brc-theme .p-breadcrumbs a,html.brc-theme .p-breadcrumbs>li a{color:#9fd6dd!important}

    html.brc-theme .block-container{background:var(--bt-card)!important;border:1px solid var(--bt-line)!important;border-radius:18px!important;
      overflow:hidden;box-shadow:0 14px 34px -18px #000e!important}
    html.brc-theme .block-header,html.brc-theme .block-minorHeader,html.brc-theme .block-filterBar,html.brc-theme .block-tabHeader,html.brc-theme .block-footer{
      background:var(--bt-card2)!important;border-color:var(--bt-line)!important;color:var(--bt-txt)!important}
    html.brc-theme .block-header{font-weight:800!important;letter-spacing:.01em}
    html.brc-theme .block-body,html.brc-theme .block-row{border-color:var(--bt-line)!important}

    html.brc-theme .node,html.brc-theme .structItem{background:transparent!important;border-color:var(--bt-line)!important;transition:background .15s}
    html.brc-theme .node:hover,html.brc-theme .structItem:hover{background:#ffffff05!important}
    html.brc-theme .node+.node,html.brc-theme .structItem+.structItem{border-top:1px solid var(--bt-line)!important}
    html.brc-theme .node-icon i,html.brc-theme .node-icon .fa,html.brc-theme .node-icon svg{color:var(--bt-acc)!important}
    html.brc-theme .node--read .node-icon i{color:#ffffff33!important}
    html.brc-theme .node-title a,html.brc-theme .structItem-title a{color:var(--bt-txt)!important;font-weight:650!important}
    html.brc-theme .node-stats,html.brc-theme .node-extra-date,html.brc-theme .structItem-minor,html.brc-theme .structItem-cell--meta{color:var(--bt-mut)!important}
    html.brc-theme .structItem-status--sticky::before{color:var(--bt-acc)!important}

    html.brc-theme .message{background:var(--bt-card)!important;border:1px solid var(--bt-line)!important;border-radius:18px!important;overflow:hidden;
      margin-bottom:12px!important;box-shadow:0 14px 34px -20px #000e!important}
    html.brc-theme .message-inner,html.brc-theme .message-cell{background:transparent!important;border-color:var(--bt-line)!important}
    html.brc-theme .message-cell--user,html.brc-theme .message-userArrow{background:#11181b!important}
    html.brc-theme .message-userArrow:after{border-right-color:#11181b!important}
    html.brc-theme .message-attribution,html.brc-theme .message-lastEdit{color:var(--bt-mut)!important;border-color:var(--bt-line)!important}
    html.brc-theme .message-footer,html.brc-theme .message-actionBar{border-color:var(--bt-line)!important}
    html.brc-theme .bbWrapper{color:#dfe7ea}
    html.brc-theme .bbCodeBlock,html.brc-theme .bbCodeBlock--quote{background:#0f1518!important;border:1px solid var(--bt-line)!important;border-left:3px solid var(--bt-acc)!important;border-radius:12px!important}
    html.brc-theme .blockStatus,html.brc-theme .blockMessage{background:var(--bt-card2)!important;border:1px solid var(--bt-line)!important;border-radius:14px!important;color:var(--bt-txt)!important}

    html.brc-theme .button,html.brc-theme a.button{border-radius:12px!important;transition:transform .12s,filter .15s}
    html.brc-theme .button:active{transform:scale(.97)}
    html.brc-theme .button--cta,html.brc-theme .button.button--cta,html.brc-theme .button--primary,html.brc-theme .p-title-pageAction .button{
      background:linear-gradient(135deg,var(--bt-acc),var(--bt-acc2))!important;border:none!important;color:#04161a!important;font-weight:800!important;
      box-shadow:0 10px 22px -10px #22c58bcc!important}
    html.brc-theme .button--cta *,html.brc-theme .button--primary *{color:#04161a!important}

    html.brc-theme .label{border-radius:7px!important;font-weight:700!important;padding:1px 8px!important}
    html.brc-theme .label[class*="green"],html.brc-theme .label[class*="Green"]{background:#22c58b24!important;color:#3ee0a4!important;border:1px solid #22c58b55!important}
    html.brc-theme .label[class*="red"],html.brc-theme .label[class*="Red"]{background:#ff5c6c24!important;color:#ff8d98!important;border:1px solid #ff5c6c55!important}
    html.brc-theme .label[class*="orange"],html.brc-theme .label[class*="yellow"]{background:#ffb54724!important;color:#ffc56e!important;border:1px solid #ffb54755!important}
    html.brc-theme .label[class*="blue"],html.brc-theme .label[class*="primary"],html.brc-theme .label[class*="accent"]{background:#40c4d324!important;color:#7fdbe5!important;border:1px solid #40c4d355!important}
    html.brc-theme .badge,html.brc-theme .badgeContainer:after{border-radius:9px!important}

    html.brc-theme .input,html.brc-theme input.input,html.brc-theme textarea.input,html.brc-theme select.input,html.brc-theme .fr-box,html.brc-theme .fr-wrapper,html.brc-theme .fr-toolbar{
      background:#0f1517!important;border-color:#ffffff16!important;color:var(--bt-txt)!important}
    html.brc-theme .input,html.brc-theme .fr-box{border-radius:12px!important}
    html.brc-theme .input:focus,html.brc-theme .fr-box.is-focused{border-color:var(--bt-acc)!important;box-shadow:0 0 0 3px #40c4d322!important}

    html.brc-theme .menu-content,html.brc-theme .offCanvasMenu-content,html.brc-theme .tooltip-content{background:#12191c!important;border:1px solid var(--bt-line)!important;border-radius:16px!important;color:var(--bt-txt)!important}
    html.brc-theme .offCanvasMenu-content{border-radius:0 20px 20px 0!important}
    html.brc-theme .offCanvasMenu-header,html.brc-theme .menu-header{background:#182226!important;border-color:var(--bt-line)!important}
    html.brc-theme .offCanvasMenu-link,html.brc-theme .menu-linkRow{color:var(--bt-txt)!important;border-color:var(--bt-line)!important}
    html.brc-theme .offCanvasMenu-link:hover,html.brc-theme .menu-linkRow:hover{background:#ffffff08!important}

    html.brc-theme .pageNav-page,html.brc-theme .pageNav-jump{border-radius:10px!important;background:var(--bt-card2)!important;border-color:var(--bt-line)!important}
    html.brc-theme .pageNav-page--current{background:var(--bt-acc)!important;color:#04161a!important;border-color:transparent!important}
    html.brc-theme .p-footer,html.brc-theme .p-footer-inner,html.brc-theme .p-footer-copyrightRow{background:#0a0f11!important;border-color:var(--bt-line)!important}
    html.brc-theme ::selection{background:#40c4d355}
  `;
  const themeOn = () => { try { return JSON.parse(localStorage.getItem('brc_theme') ?? 'true'); } catch { return true; } };
  function applyTheme(on) {
    const root = document.documentElement;
    let st = document.getElementById('brc-theme-css');
    if (!st) { st = document.createElement('style'); st.id = 'brc-theme-css'; st.textContent = THEME_CSS; (document.head || root).appendChild(st); }
    root.classList.toggle('brc-theme', !!on);
  }
  applyTheme(themeOn());

  const brcMain = () => {

  /* ===================== НАСТРОЙКИ ===================== */

  // ID префиксов — ПРОВЕРЬ: "Редактировать тему" -> список префиксов -> value у option
  // ID префиксов определяются автоматически; цифры ниже — проверенные для Khabarovsk 49 (Одобрено 8, Отказано 4, На рассмотрении 2)
  const PREFIX = {
    get ACCEPT() { return pfx('одобрен', 8); },
    get DECLINE() { return pfx('отказ', 4); },
    get WATCHED() { return pfx('рассмотр', 2); },
  };
  const FONTS = /verdana|times new roman/i;
  const MIN_FONT_PX = 15;

  const RX_NICK = /[A-Z][a-z]+_[A-Z][a-z]+/;
  const RX_SUPER = /сверхспособн|суперсил|магич|магия|колдун|колдов|ведьм|чародей|заклинан|телепорт|бессмерт|вампир|оборот(ень|ни)|телекинез|телепат|экстрасенс|воскрес|призрак|демон[а-я]*\s+(вселил|овладел)/i;

  const SECTIONS = {
    2186: {
      key: 'bio', name: 'RP-биографии', what: 'Биография',
      titleRe: /биография\s*[|│¦\/\\:\-–—]?\s*[A-Za-z]+_[A-Za-z]+/i,
      titleHint: 'Биография | Nick_Name',
      minWords: 200, maxWords: 600,
      fields: [
        ['Имя и фамилия персонажа', /(имя|фио)[^:\n]{0,30}:/i],
        ['Пол', /(^|\n)\s*пол\s*[:\-–—]|муж(ской|чина)|жен(ский|щина)/i],
        ['Возраст', /возраст/i],
        ['Национальность', /национальност/i],
        ['Образование', /образовани/i],
        ['Описание внешности', /внешност/i],
        ['Характер', /характер/i],
        ['Детство', /детств/i],
        ['Настоящее время', /настоящ(ее|ем)\s+врем|в\s+настоящее\s+время|сейчас\s+(он|она|я)\b/i],
        ['Итог', /итог|в\s+заключени/i],
      ],
      needMedia: true, mediaRule: '1.7',
    },
    2185: {
      key: 'sit', name: 'RP-ситуации', what: 'RP ситуация',
      titleRe: /^\s*\[[^\]]+\]\s*\S.{2,}$/,
      titleHint: '[Краткое название события] Событие',
      minWords: 0, maxWords: 0,
      fields: [
        ['Название', /назван/i],
        ['Пролог', /пролог/i],
        ['Сюжет', /сюжет/i],
        ['Эпилог', /эпилог/i],
        ['Ссылка на исходные материалы', /ссылка\s+на\s+исходн/i],
      ],
      needMedia: true, mediaRule: '1.4',
      needSourceLink: true,
    },
    2183: {
      key: 'org', name: 'Неоф. организации', what: 'Организация',
      titleRe: /^\s*Неофициальная\s+RP\s+организация\s+\S.+$/i,
      titleHint: 'Неофициальная RP организация [Название]',
      minWords: 0, maxWords: 0,
      fields: [
        ['Название организации', /название\s+(вашей\s+)?организац/i],
        ['История создания', /история\s+создания/i],
        ['Состав участников', /состав\s+участник/i],
        ['Устав', /устав/i],
        ['Описание деятельности', /описание\s+деятельност/i],
        ['Отличительная визуальная особенность', /визуальн/i],
        ['Как и где попасть', /как\s+и\s+где/i],
        ['Ссылка на одобренную RP биографию', /ссылка\s+на\s+(одобренную\s+)?rp\s+биограф/i],
      ],
      needMedia: true, mediaRule: '1.10',
      minMembers: 3,
      checkLeaderBio: true,
    },
  };

  /* ===================== ХЕЛПЕРЫ ===================== */

  const qs = (s, r = document) => r.querySelector(s);

  /* ===================== ОБНОВЛЕНИЯ ===================== */

  const VERSION = '5.5.0';
  // Прямая (raw) ссылка на файл скрипта. Та же, что в @updateURL сверху.
  const UPDATE_URL = 'https://raw.githubusercontent.com/IgorAkentev/br-curator/main/br-curator-forum.user.js';
  const CHECK_EVERY_H = 6; // автопроверка раз в N часов

  const ls = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem('brc_' + k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('brc_' + k, JSON.stringify(v)); } catch {} },
  };
  const verCmp = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    return 0;
  };

  for (const id in SECTIONS) SECTIONS[id].id = id;
  const SEC_ORDER = ['2186', '2185', '2183'];

  /* ===================== ШПАРГАЛКА ПРАВИЛ ===================== */

  const RULES = {
    2186: { name: 'RP-биографии', blocks: [
      ['Правила составления', [
        ['1.1', 'Заголовок: Биография | Nick_Name'],
        ['1.2', 'Реалистично — без сверхспособностей'],
        ['1.3', 'Запрещено писать биографию существующих людей (Брэд Питт, Аль Капоне и т. д.)'],
        ['1.4', 'Запрещено копировать чужие биографии'],
        ['1.5', 'Читабельно, без грамматических и орфографических ошибок'],
        ['1.6', 'Шрифт Times New Roman или Verdana, размер от 15'],
        ['1.7', 'Обязательны фото и иные материалы по истории персонажа'],
        ['1.8', 'Нельзя включать факторы, позволяющие нарушать правила сервера'],
        ['1.9', 'Объём 200–600 слов'],
        ['1.10', 'Без логических противоречий (16 лет, но окончил вуз и миллионер)'],
      ]],
      ['Форма подачи', [
        ['', 'Имя и фамилия персонажа · Пол · Возраст · Национальность · Образование · Описание внешности · Характер · Детство · Настоящее время · Итог'],
      ]],
      ['Рассмотрение', [
        ['2.1', 'Срок рассмотрения — 72 часа'],
        ['2.2', 'Можно оставить на доработку при небольших недочётах, указав что исправить. На исправление 24 часа, иначе отказ'],
      ]],
    ] },
    2185: { name: 'RP-ситуации', blocks: [
      ['Правила составления', [
        ['1.1', 'Только внутриигровая информация (без OOC)'],
        ['1.2', 'Грамотно, с соблюдением орфографии и пунктуации'],
        ['1.3', 'Правдоподобно, без сверхъестественного'],
        ['1.4', 'Обязательны скриншоты или видео с места событий'],
        ['1.5', 'Название: [Краткое название события] Событие — например «[Катастрофа] Взрыв на химическом заводе»'],
        ['1.6', 'На скринах нет OOC-информации и интерфейса (кроме системно неубираемого)'],
        ['1.7', 'Деньги и имущество за одобрение не выдаются'],
        ['1.8', 'В конце — ссылка на исходные материалы с отыгровками'],
        ['1.9', 'Шрифт Verdana или Times New Roman, размер от 15'],
        ['1.10', 'Запрещено копировать чужие ситуации'],
        ['1.11', 'Нельзя нарушать правила форума'],
      ]],
      ['Форма подачи', [
        ['', 'Название · Пролог · Сюжет · Эпилог · Ссылка на исходные материалы с отыгровками'],
      ]],
      ['Рассмотрение', [
        ['2.1', 'Срок — 72 часа'],
        ['2.2', 'Можно отказать, если противоречит игровой логике и здравому смыслу'],
        ['2.3', 'При отказе обязательно указать причину'],
        ['2.4', 'Можно оставить на доработку, указав что исправить. 24 часа, иначе отказ'],
      ]],
    ] },
    2183: { name: 'Неоф. организации', blocks: [
      ['Критерии', [
        ['', 'Минимум 3 участника'],
        ['', 'Чёткий род деятельности и своя история'],
        ['', 'Грамотно и читабельно'],
        ['', 'Шрифт Verdana или Times New Roman, размер от 15'],
        ['', 'У лидера должна быть одобренная RP биография'],
        ['', 'Отличительная визуальная особенность (например, все носят маску зомби)'],
      ]],
      ['Правила', [
        ['1.1', 'Деятельность не нарушает правила проекта'],
        ['1.2', 'После одобрения тема открыта, лидер публикует отчёты. Неделя без сообщений лидера — роспуск, тема закрывается'],
        ['1.3', 'Раз в месяц можно заморозить на 2 недели, предупредив в теме'],
        ['1.4', 'Нельзя нарушать правила форума в заявке'],
        ['1.5', 'Нельзя копировать чужие орги и воссоздавать свои распущенные'],
        ['1.6', 'Нельзя создавать в форме госфракций (например «Росгвардия»)'],
        ['1.7', 'Администрация не спонсирует организации'],
        ['1.8', 'Название темы: Неофициальная RP организация [Название]'],
        ['1.9', 'Название отражает тематику'],
        ['1.10', 'Заявка с фото или видео; на скринах без OOC и интерфейса'],
      ]],
      ['Форма заявки', [
        ['', 'Название · История создания · Состав участников · Устав · Описание деятельности · Отличительная визуальная особенность · Как и где попасть · Ссылка на одобренную RP биографию'],
      ]],
      ['Форма отчёта', [
        ['', 'Дата события · Краткое описание · Состав участников · Доказательства'],
      ]],
      ['Рассмотрение', [
        ['2.1', 'Срок — 72 часа'],
        ['2.2', 'Можно отказать, если противоречит игровой логике'],
        ['2.3', 'При отказе обязательно указать причину'],
        ['2.4', 'При одобрении тема закрепляется'],
        ['2.5', 'Доработка: указать что исправить, 24 часа, иначе отказ'],
        ['2.6', 'Неделя без активности лидера — тема закрывается и переносится (роспуск)'],
      ]],
    ] },
  };

  function openRules(startId) {
    if (!document.getElementById('brc-rules-css')) {
      const c = document.createElement('style');
      c.id = 'brc-rules-css';
      c.textContent = `
        #brc-rules{position:fixed;inset:0;z-index:100004;background:#000a;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(3px);
          font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#e6edf0}
        #brc-rules .md{width:100%;max-width:560px;max-height:88vh;display:flex;flex-direction:column;background:#11181b;border:1px solid #3ec6d055;
          border-radius:22px 22px 0 0;box-shadow:0 -10px 40px #000c;animation:brcupR .25s}
        @media(min-width:600px){#brc-rules{align-items:center}#brc-rules .md{border-radius:22px}}
        @keyframes brcupR{from{transform:translateY(40px);opacity:.5}}
        #brc-rules .top{padding:16px 16px 10px;border-bottom:1px solid #ffffff12}
        #brc-rules .h{display:flex;align-items:center;gap:10px}
        #brc-rules .h b{flex:1;font-size:17px}
        #brc-rules .x{background:#ffffff14;border:none;color:#e6edf0;width:34px;height:34px;border-radius:10px;font-size:18px;cursor:pointer}
        #brc-rules .tabs{display:flex;gap:6px;margin-top:12px}
        #brc-rules .tab{flex:1;padding:8px 4px;border-radius:10px;border:1px solid #ffffff14;background:#ffffff08;color:#8b9aa1;font-weight:700;font-size:12px;cursor:pointer}
        #brc-rules .tab.on{color:#3ec6d0;border-color:#3ec6d0;background:#3ec6d014}
        #brc-rules input{width:100%;box-sizing:border-box;margin-top:10px;padding:9px 12px;border-radius:10px;border:1px solid #ffffff22;background:#0b1012;color:#e6edf0;font-size:13px}
        #brc-rules .bd{overflow:auto;padding:6px 16px 18px}
        #brc-rules .bl{margin-top:14px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#8b9aa1;text-transform:uppercase}
        #brc-rules .rl{display:flex;gap:10px;padding:9px 11px;border-radius:10px;background:#ffffff08;margin-top:6px}
        #brc-rules .n{flex:none;min-width:34px;height:22px;padding:0 6px;border-radius:7px;background:#3ec6d022;color:#3ec6d0;font-weight:800;font-size:12px;display:grid;place-items:center}
        #brc-rules .n.e{background:#1ec27a22;color:#1ec27a}
        #brc-rules mark{background:#ffb54755;color:inherit;border-radius:3px}
        #brc-rules .em{color:#8b9aa1;text-align:center;padding:20px}
      `;
      document.head.appendChild(c);
    }
    document.getElementById('brc-rules')?.remove();
    const m = document.createElement('div');
    m.id = 'brc-rules';
    let cur = RULES[startId] ? startId : SEC_ORDER[0];
    m.innerHTML = `<div class="md"><div class="top">
        <div class="h"><b>📖 Правила разделов</b><button class="x">✕</button></div>
        <div class="tabs">${SEC_ORDER.map((id) => `<button class="tab" data-id="${id}">${RULES[id].name}</button>`).join('')}</div>
        <input placeholder="Поиск по правилам: шрифт, фото, 72…">
      </div><div class="bd"></div></div>`;
    document.body.appendChild(m);
    const bd = m.querySelector('.bd'), inp = m.querySelector('input');
    const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const hl = (t, q) => (q ? esc(t).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), (x) => `<mark>${x}</mark>`) : esc(t));
    function draw() {
      m.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.id === cur));
      const q = inp.value.trim().toLowerCase();
      const html = RULES[cur].blocks.map(([bt, items]) => {
        const f = items.filter(([n, t]) => !q || (n + ' ' + t).toLowerCase().includes(q));
        return f.length ? `<div class="bl">${bt}</div>` + f.map(([n, t]) => `<div class="rl"><span class="n ${n ? '' : 'e'}">${n || '•'}</span><span>${hl(t, q)}</span></div>`).join('') : '';
      }).join('');
      bd.innerHTML = html || '<div class="em">Ничего не нашёл</div>';
    }
    m.querySelectorAll('.tab').forEach((t) => (t.onclick = () => { cur = t.dataset.id; draw(); }));
    inp.oninput = draw;
    m.querySelector('.x').onclick = () => m.remove();
    m.onclick = (e) => { if (e.target === m) m.remove(); };
    draw();
  }

  // Подпись куратора в ответах
  const myNick = () => (document.querySelector('.p-navgroup-link--user .p-navgroup-linkText, .p-navgroup-user-linkText')?.textContent || '').trim();
  const SIG_DEF = 'С уважением, куратор форума {nick}';
  const signature = () => ls.get('sig_on', false)
    ? `<br>[RIGHT][I][COLOR=${ls.get('sig_color', 'rgb(139, 154, 161)')}]${ls.get('sig_text', SIG_DEF).replaceAll('{nick}', myNick())}[/COLOR][/I][/RIGHT]` : '';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // Автоопределение ID префиксов: ссылки вида ...?prefix_id=8 с текстом «Одобрено»
  function learnPrefixes(root) {
    const m = ls.get('prefix_map', {});
    let ch = false;
    const add = (id, t) => {
      t = (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (id && t && t.length < 40 && m[t] !== +id) { m[t] = +id; ch = true; }
    };
    root.querySelectorAll('a[href*="prefix_id"]').forEach((a) => {
      const id = (decodeURIComponent(a.getAttribute('href')).match(/prefix_id(?:\[\d*\])?=(\d+)/) || [])[1];
      add(id, a.textContent);
    });
    root.querySelectorAll('select[name="prefix_id"] option').forEach((o) => +o.value && add(o.value, o.textContent));
    if (ch) ls.set('prefix_map', m);
    return m;
  }
  // Подразделы для переноса тем: «Одобренные…», «Неодобренные…», «…на доработке», «Распущенные/Архив»
  function learnMoves(root, secId) {
    if (!SECTIONS[secId]) return;
    const mm = ls.get('move_map', {});
    const t = mm[secId] || {};
    let found = false;
    root.querySelectorAll('.node-title a[href*="/forums/"], .subNodeLink[href*="/forums/"]').forEach((a) => {
      const href = a.getAttribute('href');
      const id = (href.match(/\.(\d+)\/?(?:[?#].*)?$/) || href.match(/\/forums\/(\d+)\/?/) || [])[1];
      const nm = a.textContent.replace(/\s+/g, ' ').trim();
      const n = nm.toLowerCase();
      if (!id || id === secId) return;
      const v = { id: +id, name: nm };
      if (/неодобр|отказ|отклон/.test(n)) { t.dec = v; found = true; }
      else if (/доработ/.test(n)) { t.rw = v; found = true; }
      else if (/распущ|архив|закрыт/.test(n)) { t.arc = v; found = true; }
      else if (/одобрен|принят/.test(n)) { t.acc = v; found = true; }
    });
    if (found) { mm[secId] = t; ls.set('move_map', mm); }
  }

  function pfx(name, def) {
    const m = ls.get('prefix_map', {});
    const k = Object.keys(m).find((k) => k.includes(name));
    return k ? m[k] : def;
  }
  learnPrefixes(document);

  // Очередь раздела: незакрытые темы без вердикта, самые горящие первыми
  function queueFromDoc(root) {
    const now = Date.now() / 1000;
    const out = [];
    root.querySelectorAll('.structItem--thread').forEach((it) => {
      if (it.querySelector('.structItem-status--sticky')) return;
      const pref = (it.querySelector('.structItem-title .label')?.textContent || '').trim();
      if (it.querySelector('.structItem-status--locked') || /одобрен|отказ|закрыт/i.test(pref)) return;
      const t = +(it.querySelector('.structItem-startDate time, time.u-dt')?.getAttribute('data-time') || 0);
      const a = [...it.querySelectorAll('.structItem-title a[href*="/threads/"]')].pop();
      if (!t || !a) return;
      const href = new URL(a.getAttribute('href'), location.origin).href;
      out.push({ it, t, href, id: (href.match(/\.(\d+)\//) || [])[1], title: a.textContent.trim(), left: 72 - Math.floor((now - t) / 3600) });
    });
    learnPrefixes(root);
    return out.sort((a, b) => a.left - b.left);
  }
  // Запоминаем настоящие адреса разделов (из хлебных крошек и ссылок на странице)
  (function learnSecUrls() {
    const su = ls.get('sec_url', {});
    let ch = false;
    for (const id of Object.keys(SECTIONS)) {
      const a = document.querySelector(`a[href*=".${id}/"]`);
      if (a) { const u = new URL(a.getAttribute('href'), location.origin).pathname.replace(/(\.\d+\/).*/, '$1'); if (su[id] !== u) { su[id] = u; ch = true; } }
    }
    if (ch) ls.set('sec_url', su);
  })();
  const secUrl = (id) => ls.get('sec_url', {})[id] || `/forums/${id}/`;

  const getDoc = async (url) => new DOMParser().parseFromString(await (await fetch(url, { credentials: 'same-origin' })).text(), 'text/html');
  async function fetchQueue(id) {
    const d = await getDoc(secUrl(id));
    learnMoves(d, String(id));
    if (!d.querySelector('.structItem--thread, .js-threadList, .structItemContainer')) throw new Error('раздел не открылся');
    return queueFromDoc(d);
  }

  // Поиск ID префиксов: форма редактирования темы + подразделы
  const pfxDone = () => ['одобрен', 'отказ', 'рассмотр'].every((k) => Object.keys(ls.get('prefix_map', {})).some((x) => x.includes(k)));
  async function findPrefixes() {
    ls.set('pfx_try', Date.now());
    const edits = [];
    const cur = location.href.match(/^(https:\/\/forum\.blackrussia\.online\/threads\/[^/]+\.\d+\/)/);
    if (cur) edits.push(cur[1] + 'edit');
    const pushEdit = (d) => {
      const th = d.querySelector('.structItem-title a[href*="/threads/"]:not(.labelLink)');
      if (th) edits.push(new URL(th.getAttribute('href'), location.origin).href.replace(/(\/threads\/[^/]+\/).*/, '$1') + 'edit');
    };
    for (const id of SEC_ORDER) {
      try {
        const d = await getDoc(secUrl(id));
        learnPrefixes(d);
        learnMoves(d, id);
        pushEdit(d);
        if (!pfxDone()) {
          const subs = [...d.querySelectorAll('.node-title a[href*="/forums/"], .subNodeLink[href*="/forums/"]')].slice(0, 3);
          for (const a of subs) { const sd = await getDoc(a.getAttribute('href')); learnPrefixes(sd); pushEdit(sd); await wait(250); }
        }
      } catch {}
      await wait(250);
    }
    for (const u of edits.slice(0, 3)) {
      if (pfxDone()) break;
      try { learnPrefixes(await getDoc(u)); } catch {}
      await wait(250);
    }
    return pfxDone();
  }

  (function updater() {
    const GEAR = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/></svg>`;

    const st = document.createElement('style');
    st.textContent = `
      #brc-fab{position:fixed;left:14px;bottom:90px;z-index:100001;width:50px;height:50px;border-radius:16px;border:1px solid #ffffff30;
        display:grid;place-items:center;padding:0;transition:transform .25s,box-shadow .25s;
        background:linear-gradient(135deg,#3ec6d0,#1ec27a);box-shadow:0 6px 18px #1ec27a55;cursor:pointer}
      #brc-fab svg,#brc-upd .hd svg{width:26px!important;height:26px!important;transition:transform .5s;fill:none!important}
      #brc-fab svg *,#brc-upd .hd svg *{fill:none!important;stroke:#fff!important;stroke-width:2px!important}
      #brc-fab.open svg{transform:rotate(90deg)}
      #brc-fab:active{transform:scale(.92)}
      #brc-fab .dot{position:absolute;top:-4px;right:-4px;width:14px;height:14px;border-radius:50%;background:#ff5468;border:2px solid #11181b;display:none;
        animation:brcpulse 1.4s infinite}
      #brc-fab .cnt{position:absolute;bottom:-7px;right:-9px;min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:#ff5468;color:#fff;
        font:800 11px/18px -apple-system,Segoe UI,Roboto,sans-serif;border:2px solid #11181b;display:none;box-sizing:border-box}
      @keyframes brcpulse{0%{box-shadow:0 0 0 0 #ff546899}70%{box-shadow:0 0 0 8px #ff546800}100%{box-shadow:0 0 0 0 #ff546800}}

      #brc-upd{position:fixed;left:14px;bottom:150px;z-index:100001;width:310px;max-width:calc(100vw - 28px);max-height:calc(100vh - 170px);overflow:auto;
        border-radius:20px;padding:1px;background:linear-gradient(135deg,#3ec6d0aa,#1ec27a33 45%,#ffffff12 65%,#3ec6d055);
        box-shadow:0 18px 50px #000c;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;color:#e6edf0;
        opacity:0;transform:translateY(10px) scale(.97);transform-origin:bottom left;pointer-events:none;transition:opacity .2s,transform .2s}
      #brc-upd.open{opacity:1;transform:none;pointer-events:auto}
      #brc-upd .in{border-radius:19px;background:#11181b;padding:16px;backdrop-filter:blur(8px)}
      #brc-upd .hd{display:flex;align-items:center;gap:12px}
      #brc-upd .logo{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:linear-gradient(135deg,#3ec6d0,#1ec27a);flex:none}
      #brc-upd .nm{font-size:16px;font-weight:800;white-space:nowrap}
      #brc-upd .sb{font-size:12px;color:#8b9aa1}
      #brc-upd .ver{margin-left:auto;padding:3px 9px;border-radius:20px;background:#1ec27a22;color:#1ec27a;font-weight:800;font-size:12px}
      #brc-upd .card{margin-top:14px;padding:12px;border-radius:14px;background:#ffffff08;border:1px solid #ffffff12}
      #brc-upd .card.new{background:#ff546812;border-color:#ff546844}
      #brc-upd .card.ok{background:#1ec27a10;border-color:#1ec27a33}
      #brc-upd .row1{display:flex;align-items:center;gap:8px;font-weight:700}
      #brc-upd .tm{font-size:11px;color:#8b9aa1;margin-top:4px}
      #brc-upd ul{margin:8px 0 0;padding-left:18px;color:#c9d4d8}
      #brc-upd li{margin:3px 0}
      #brc-upd .btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:10px;padding:11px;border:none;border-radius:12px;
        font-weight:800;font-size:13px;cursor:pointer;color:#e6edf0;background:#ffffff10}
      #brc-upd .btn.pri{background:linear-gradient(135deg,#3ec6d0,#1ec27a);color:#fff;box-shadow:0 6px 18px #1ec27a44}
      #brc-upd .btn:active{transform:scale(.97)}
      #brc-upd .btn.spin span{display:inline-block;animation:brcrot .8s linear infinite}
      @keyframes brcrot{to{transform:rotate(360deg)}}
      #brc-upd .ttl{margin:16px 0 6px;font-size:11px;font-weight:800;letter-spacing:.08em;color:#8b9aa1}
      #brc-upd .opt{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:12px;background:#ffffff08;margin-bottom:5px;cursor:pointer;font-weight:600}
      #brc-upd .opt .tx{flex:1}
      #brc-upd .opt .tx small{display:block;color:#8b9aa1;font-size:11px}
      #brc-upd .sw{position:relative;width:40px;height:23px;border-radius:20px;background:#ffffff22;flex:none;transition:.2s}
      #brc-upd .sw::after{content:'';position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;transition:.2s}
      #brc-upd .opt.on .sw{background:#1ec27a}
      #brc-upd .opt.on .sw::after{left:20px}
      #brc-upd .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      #brc-upd .grid .btn{margin-top:0;font-size:12px;padding:10px 6px}
      #brc-upd .ttl .rf{float:right;background:none;border:none;color:#3ec6d0;font-weight:800;cursor:pointer;font-size:11px}
      #brc-upd .qrow{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:12px;background:#ffffff08;margin-bottom:6px;color:#e6edf0;text-decoration:none}
      #brc-upd .qrow .nm2{flex:1;font-weight:700}
      #brc-upd .qn{padding:2px 8px;border-radius:10px;background:#ffffff14;font-weight:800;font-size:12px}
      #brc-upd .ql{padding:2px 8px;border-radius:10px;background:#ff5468;color:#fff;font-weight:800;font-size:12px}
      #brc-upd .qs{padding:2px 8px;border-radius:10px;background:#ffb54733;color:#ffb547;font-weight:800;font-size:12px}
      #brc-upd .qe{color:#8b9aa1;font-size:12px}
      #brc-upd .sigbox{padding:10px 12px;border-radius:12px;background:#ffffff08;margin-bottom:6px}
      #brc-upd .sigbox input{width:100%;box-sizing:border-box;padding:9px 11px;border-radius:9px;border:1px solid #ffffff22;background:#0b1012;color:#e6edf0;font-size:13px}
      #brc-upd .sigc{display:flex;gap:8px;margin:10px 0 8px}
      #brc-upd .sc{width:26px;height:26px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}
      #brc-upd .sc.on{border-color:#fff;box-shadow:0 0 0 2px #11181b inset}
      #brc-upd .sigpv{text-align:right;font-style:italic;padding:8px 10px;border-radius:9px;background:#2a3236;margin-bottom:6px;min-height:18px}
      #brc-upd .mtabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:12px;padding:4px;border-radius:12px;background:#ffffff0a}
      #brc-upd .mt{display:flex;flex-direction:column;align-items:center;gap:1px;padding:6px 2px;border:none;border-radius:9px;background:none;color:#8b9aa1;font-weight:700;font-size:10.5px;cursor:pointer}
      #brc-upd .mt span{font-size:16px}
      #brc-upd .mt.on{background:#3ec6d022;color:#3ec6d0}
      #brc-upd .pane{margin-top:10px}
      #brc-upd .pane > .card{margin-top:0}
      #brc-upd .opt .oi{width:22px;text-align:center;font-size:15px}
      #brc-upd .ft{margin-top:10px;text-align:center;font-size:11px;color:#8b9aa1}
      #brc-upd .ft a{color:#3ec6d0;text-decoration:none;font-weight:700}
    `;
    document.head.appendChild(st);

    const fab = document.createElement('button');
    fab.id = 'brc-fab';
    fab.title = 'Скрипт кураторов';
    fab.innerHTML = GEAR + '<span class="dot"></span><span class="cnt"></span>';

    const OPTS = [
      ['theme', true, '🎨', 'Тема форума'],
      ['preview', true, '👁', 'Предпросмотр ответа'],
      ['auto_send', false, '⚡', 'Мгновенная отправка'],
      ['move', true, '📂', 'Переносить в подразделы'],
      ['auto_next', false, '➡️', 'Дальше по очереди'],
      ['q_badge', true, '🔴', 'Счётчик на иконке'],
      ['queue', true, '⏱', 'Таймеры в разделах'],
      ['min', false, '▾', 'Свёрнутая панель'],
    ];
    const opt = ([k, d, ic, n]) => `<div class="opt ${ls.get(k, d) ? 'on' : ''}" data-k="${k}" data-d="${d}"><span class="oi">${ic}</span><div class="tx">${n}</div><div class="sw"></div></div>`;
    const TABS = [['main', '🏠', 'Главное'], ['set', '⚙️', 'Настройки'], ['forum', '🧩', 'Форум'], ['sig', '✍️', 'Подпись']];

    const pnl = document.createElement('div');
    pnl.id = 'brc-upd';
    pnl.innerHTML = `<div class="in">
      <div class="hd">
        <div class="logo">${GEAR}</div>
        <div><div class="nm">Скрипт кураторов</div><div class="sb">Khabarovsk 49</div></div>
        <div class="ver">v${VERSION}</div>
      </div>
      <div class="mtabs">${TABS.map(([k, ic, n]) => `<button class="mt" data-t="${k}"><span>${ic}</span>${n}</button>`).join('')}</div>

      <div class="pane" data-p="main">
        <div class="card" id="brc-upd-card">
          <div class="row1" id="brc-upd-st">Обновления ещё не проверялись</div>
          <div class="tm" id="brc-upd-tm"></div>
          <div id="brc-upd-notes"></div>
          <button class="btn pri" id="brc-upd-ins" style="display:none">⬇️ Установить обновление</button>
          <button class="btn" id="brc-upd-chk"><span>🔄</span> Проверить обновления</button>
        </div>
        <div class="ttl">ОЧЕРЕДЬ <button class="rf" id="brc-qrf">↻ обновить</button></div>
        <div id="brc-q"><div class="qe">Загружаю…</div></div>
        <button class="btn" id="brc-rules-b">📖 Правила разделов</button>
      </div>

      <div class="pane" data-p="set">
        ${OPTS.map(opt).join('')}
        <div class="grid" style="margin-top:8px">
          <button class="btn" id="brc-clr">🧹 Сбросить кэш</button>
          <button class="btn" id="brc-cust">🗑 Свои причины</button>
        </div>
      </div>

      <div class="pane" data-p="forum">
        <div class="ttl" style="margin-top:4px">ПРЕФИКСЫ <button class="rf" id="brc-pfx-rf">↻ найти</button></div>
        <div id="brc-pfx"></div>
      </div>

      <div class="pane" data-p="sig">
        ${opt(['sig_on', false, '✍️', 'Добавлять подпись'])}
        <div class="sigbox">
          <input id="brc-sig" maxlength="120" placeholder="${SIG_DEF}">
          <div class="sigc">${['rgb(139, 154, 161)', 'rgb(62, 198, 208)', 'rgb(30, 194, 122)', 'rgb(255, 181, 71)', 'rgb(166, 107, 255)', 'rgb(255, 84, 104)'].map((c) => `<button class="sc" data-c="${c}" style="background:${c}"></button>`).join('')}</div>
          <div class="sigpv" id="brc-sigpv"></div>
          <div class="qe">{nick} заменится на твой ник</div>
        </div>
      </div>

      <div class="ft"><a href="https://github.com/IgorAkentev/br-curator" target="_blank">GitHub</a></div>
    </div>`;
    const showTab = (t) => {
      pnl.querySelectorAll('.mt').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
      pnl.querySelectorAll('.pane').forEach((p) => (p.style.display = p.dataset.p === t ? 'block' : 'none'));
      ls.set('menu_tab', t);
    };
    pnl.querySelectorAll('.mt').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); showTab(b.dataset.t); }));
    showTab(ls.get('menu_tab', 'main'));
    document.body.append(fab, pnl);

    const setOpen = (o) => { pnl.classList.toggle('open', o); fab.classList.toggle('open', o); };
    fab.onclick = (e) => { e.stopPropagation(); setOpen(!pnl.classList.contains('open')); };
    document.addEventListener('click', (e) => { if (!pnl.contains(e.target) && e.target !== fab) setOpen(false); });

    // подпись
    const sigIn = pnl.querySelector('#brc-sig');
    const sigPv = pnl.querySelector('#brc-sigpv');
    sigIn.value = ls.get('sig_text', SIG_DEF);
    const drawSig = () => {
      const col = ls.get('sig_color', 'rgb(139, 154, 161)');
      pnl.querySelectorAll('.sc').forEach((b) => b.classList.toggle('on', b.dataset.c === col));
      sigPv.style.color = col;
      sigPv.style.opacity = ls.get('sig_on', false) ? 1 : 0.4;
      sigPv.textContent = (sigIn.value || SIG_DEF).replaceAll('{nick}', myNick() || 'Ник');
    };
    sigIn.oninput = () => { ls.set('sig_text', sigIn.value); drawSig(); };
    pnl.querySelectorAll('.sc').forEach((b) => (b.onclick = () => { ls.set('sig_color', b.dataset.c); drawSig(); }));
    drawSig();
    pnl.querySelector('#brc-rules-b').onclick = () => { setOpen(false); openRules((document.querySelector('.p-breadcrumbs a[href*=".2186/"]') && '2186') || (document.querySelector('.p-breadcrumbs a[href*=".2185/"]') && '2185') || (document.querySelector('.p-breadcrumbs a[href*=".2183/"]') && '2183') || (location.pathname.match(/(\d+)\/?$/) || [])[1]); };

    pnl.querySelectorAll('.opt').forEach((o) => {
      o.onclick = () => {
        const v = !o.classList.contains('on');
        o.classList.toggle('on', v);
        ls.set(o.dataset.k, v);
        if (o.dataset.k === 'min') document.getElementById('brc')?.classList.toggle('min', v);
        if (o.dataset.k === 'q_badge') refreshQueue();
        if (o.dataset.k === 'sig_on') drawSig();
        if (o.dataset.k === 'theme') applyTheme(v);
      };
    });

    const pfxEl = pnl.querySelector('#brc-pfx');
    function showPfx() {
      const m = ls.get('prefix_map', {});
      pfxEl.innerHTML = [['одобрен', 'Одобрено', '#1ec27a'], ['отказ', 'Отказано', '#ff5468'], ['рассмотр', 'На рассмотрении', '#ffb547']].map(([k, n, c]) => {
        const key = Object.keys(m).find((x) => x.includes(k));
        return `<div class="qrow"><span class="nm2" style="color:${c}">${n}</span>${key
          ? `<span class="qn">ID ${m[key]}</span><span style="color:#1ec27a">✓</span>`
          : `<span class="qe">не найден</span>`}</div>`;
      }).join('') + (() => {
        const mm = ls.get('move_map', {});
        const L = { acc: '✅', dec: '⛔', rw: '🛠', arc: '📦' };
        return '<div class="ttl" style="margin-top:12px">ПОДРАЗДЕЛЫ ДЛЯ ПЕРЕНОСА</div>' + SEC_ORDER.map((id) => {
          const t = mm[id] || {};
          const items = ['acc', 'dec', 'rw', 'arc'].filter((k) => t[k]).map((k) => `${L[k]} ${t[k].name}`);
          return `<div class="qrow" style="flex-wrap:wrap"><span class="nm2">${SECTIONS[id].name}</span>${items.length
            ? `<span class="qe" style="flex-basis:100%">${items.join('<br>')}</span>` : '<span class="qe">не найдены — открой раздел</span>'}</div>`;
        }).join('');
      })();
    }
    showPfx();
    pnl.querySelector('#brc-pfx-rf').onclick = async (e) => {
      e.stopPropagation();
      pfxEl.innerHTML = '<div class="qe">Ищу в разделах и в форме редактирования темы…</div>';
      const ok = await findPrefixes();
      showPfx();
      if (!ok) pfxEl.insertAdjacentHTML('beforeend', '<div class="qe" style="margin-top:6px">Открой любую тему из раздела и нажми «↻ найти» ещё раз — скрипт возьмёт ID из формы редактирования.</div>');
    };
    // тихий автопоиск, если чего-то не хватает (не чаще раза в 6 ч)
    if (!pfxDone() && Date.now() - ls.get('pfx_try', 0) > 6 * 3600e3) findPrefixes().then(showPfx);

    const say = (m) => { const b = pnl.querySelector('#brc-upd-st'); const old = b.innerHTML; b.innerHTML = m; setTimeout(() => (b.innerHTML = old), 1800); };
    pnl.querySelector('#brc-clr').onclick = () => {
      Object.keys(localStorage).filter((k) => k.startsWith('brc_c_')).forEach((k) => localStorage.removeItem(k));
      say('🧹 Кэш поиска очищен');
    };
    pnl.querySelector('#brc-cust').onclick = () => {
      const n = ['bio', 'sit', 'org'].reduce((a, k) => a + ls.get('custom_' + k, []).length, 0);
      if (!n) return say('Своих причин пока нет');
      if (!confirm(`Удалить все свои причины (${n})?`)) return;
      ['bio', 'sit', 'org'].forEach((k) => ls.set('custom_' + k, []));
      say('🗑 Свои причины удалены');
    };

    const card = pnl.querySelector('#brc-upd-card');
    const stEl = pnl.querySelector('#brc-upd-st');
    const tmEl = pnl.querySelector('#brc-upd-tm');
    const notesEl = pnl.querySelector('#brc-upd-notes');
    const insBtn = pnl.querySelector('#brc-upd-ins');
    const chkBtn = pnl.querySelector('#brc-upd-chk');
    insBtn.onclick = () => { location.href = UPDATE_URL; }; // Tampermonkey сам откроет окно установки

    const showTime = () => {
      const last = ls.get('last_check', 0);
      tmEl.textContent = last ? 'Проверено: ' + new Date(last).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    };
    showTime();
    // показать последний известный статус, не дожидаясь новой проверки
    (() => {
      const rv = ls.get('remote_ver', '');
      if (!rv) return;
      if (verCmp(rv, VERSION) > 0) { card.className = 'card new'; stEl.innerHTML = `🔥 Доступна версия <span style="color:#1ec27a">${rv}</span>`; insBtn.style.display = 'flex'; fab.querySelector('.dot').style.display = 'block'; }
      else { card.className = 'card ok'; stEl.innerHTML = '✅ Установлена последняя версия'; }
    })();

    async function check(manual) {
      if (!UPDATE_URL.startsWith('https://')) { stEl.textContent = '⚠️ Ссылка на обновления не настроена'; return; }
      chkBtn.classList.add('spin');
      try {
        const src = await (await fetch(UPDATE_URL + '?t=' + Date.now(), { cache: 'no-store' })).text();
        const remote = (src.match(/@version\s+([\d.]+)/) || [])[1];
        if (!remote) throw new Error('не нашёл @version');
        ls.set('last_check', Date.now());
        ls.set('remote_ver', remote);
        showTime();
        if (verCmp(remote, VERSION) > 0) {
          const notes = [...src.matchAll(/\/\/\s*@note\s+(.+)/g)].map((m) => m[1])
            .filter((n) => { const v = (n.match(/^([\d.]+)/) || [])[1]; return !v || verCmp(v, VERSION) > 0; });
          card.className = 'card new';
          stEl.innerHTML = `🔥 Доступна версия <span style="color:#1ec27a">${remote}</span>`;
          notesEl.innerHTML = notes.length ? `<ul>${notes.map((n) => `<li>${n.replace(/^[\d.]+\s*—\s*/, '')}</li>`).join('')}</ul>` : '';
          insBtn.style.display = 'flex';
          fab.querySelector('.dot').style.display = 'block';
          if (!manual) setOpen(true);
        } else {
          card.className = 'card ok';
          stEl.innerHTML = '✅ Установлена последняя версия';
          notesEl.innerHTML = '';
          insBtn.style.display = 'none';
          fab.querySelector('.dot').style.display = 'none';
        }
      } catch (e) {
        card.className = 'card';
        stEl.textContent = '❌ Не удалось проверить: ' + e.message;
      }
      chkBtn.classList.remove('spin');
    }

    // ---- очередь по всем разделам ----
    const cntEl = fab.querySelector('.cnt');
    const qEl = pnl.querySelector('#brc-q');
    async function refreshQueue(force) {
      let c = ls.get('q_cache', null);
      if (force || !c || Date.now() - c.ts > 10 * 60e3) {
        qEl.innerHTML = '<div class="qe">Загружаю…</div>';
        const secs = {};
        for (const id of SEC_ORDER) {
          try {
            const q = await fetchQueue(id);
            secs[id] = { total: q.length, late: q.filter((x) => x.left <= 0).length, soon: q.filter((x) => x.left > 0 && x.left <= 24).length };
          } catch { secs[id] = null; }
          await wait(400);
        }
        c = { ts: Date.now(), secs };
        ls.set('q_cache', c);
      }
      let late = 0;
      qEl.innerHTML = SEC_ORDER.map((id) => [id, SECTIONS[id]]).map(([id, sc]) => {
        const x = c.secs[id];
        if (!x) return `<div class="qrow"><span class="nm2">${sc.name}</span><span class="qe">не загрузилось</span></div>`;
        late += x.late;
        return `<a class="qrow" href="${secUrl(id)}"><span class="nm2">${sc.name}</span>
          ${x.late ? `<span class="ql">🔥 ${x.late}</span>` : ''}${x.soon ? `<span class="qs">⏳ ${x.soon}</span>` : ''}
          <span class="qn">${x.total}</span></a>`;
      }).join('');
      const show = ls.get('q_badge', true) && late > 0;
      cntEl.style.display = show ? 'block' : 'none';
      cntEl.textContent = late > 99 ? '99+' : late;
    }
    pnl.querySelector('#brc-qrf').onclick = (e) => { e.stopPropagation(); refreshQueue(true); };
    refreshQueue();

    chkBtn.onclick = () => check(true);
    if (Date.now() - ls.get('last_check', 0) > CHECK_EVERY_H * 3600e3) check(false);
  })();

  /* ===================== 3. ОЧЕРЕДЬ НА СТРАНИЦЕ РАЗДЕЛА ===================== */

  (function queue() {
    const mm0 = location.pathname.match(/^\/forums\/(?:[^/]*\.)?(\d+)\/?/);
    if (mm0 && SECTIONS[mm0[1]]) learnMoves(document, mm0[1]);
    if (!ls.get('queue', true)) return;
    const m = location.pathname.match(/^\/forums\/(?:[^/]*\.)?(\d+)\/?/);
    if (!m || !SECTIONS[m[1]]) return;
    learnMoves(document, m[1]);
    if (!document.querySelector('.structItem--thread')) return;

    const st = document.createElement('style');
    st.textContent = `
      .brcq{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:12px;font:700 11px/18px -apple-system,Segoe UI,Roboto,sans-serif;vertical-align:middle;white-space:nowrap}
      .brcq.g{background:#1ec27a22;color:#1ec27a}.brcq.y{background:#ffb54722;color:#ffb547}.brcq.r{background:#ff5468;color:#fff}.brcq.b{background:#3ec6d022;color:#3ec6d0}
      .brcq-late{box-shadow:inset 3px 0 0 #ff5468}
      #brcq-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:10px 0;padding:12px 14px;border-radius:14px;
        background:#11181bf2;border:1px solid #3ec6d055;color:#e6edf0;font:13px/1.4 -apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 18px #0006}
      #brcq-bar b{font-size:15px}
      #brcq-bar .sp{flex:1}
      #brcq-bar .rul{background:#ffffff14!important}
      #brcq-bar button{border:none;border-radius:10px;padding:8px 12px;font-weight:800;color:#fff;cursor:pointer;background:linear-gradient(135deg,#3ec6d0,#1ec27a)}
    `;
    document.head.appendChild(st);

    const chip = (it, cls, txt) => {
      const c = document.createElement('span');
      c.className = 'brcq ' + cls; c.textContent = txt;
      (it.querySelector('.structItem-title') || it).appendChild(c);
    };

    const data = queueFromDoc(document);
    for (const d of data) {
      chip(d.it, d.left <= 0 ? 'r' : d.left <= 24 ? 'y' : 'g', d.left <= 0 ? `⏱ просрочено на ${-d.left} ч` : `⏱ ${d.left} ч`);
      if (d.left <= 0) d.it.classList.add('brcq-late');
    }

    // Одобренные (закреплённые) организации — когда в теме последний раз была активность
    if (SECTIONS[m[1]].key === 'org') {
      document.querySelectorAll('.structItem--thread').forEach((it) => {
        if (!it.querySelector('.structItem-status--sticky')) return;
        const t = +(it.querySelector('.structItem-latestDate time, .structItem-cell--latest time')?.getAttribute('data-time') || 0);
        if (!t) return;
        const days = Math.floor((Date.now() / 1000 - t) / 86400);
        chip(it, days >= 7 ? 'r' : 'b', days >= 7 ? `💤 тишина ${days} дн` : `активность ${days} дн назад`);
      });
    }

    const late = data.filter((d) => d.left <= 0).length;
    const soon = data.filter((d) => d.left > 0 && d.left <= 24).length;
    const bar = document.createElement('div');
    bar.id = 'brcq-bar';
    bar.innerHTML = `<span>📋 В очереди: <b>${data.length}</b></span>
      <span style="color:#ff5468">🔥 Просрочено: <b>${late}</b></span>
      <span style="color:#ffb547">⏳ Меньше суток: <b>${soon}</b></span>
      <span class="sp"></span><button class="rul">📖 Правила</button><button class="srt">⇅ По сроку</button>`;
    const first = document.querySelector('.structItem--thread');
    const anchorEl = first.closest('.block') || first.parentElement;
    anchorEl.parentElement.insertBefore(bar, anchorEl);

    bar.querySelector('.rul').onclick = () => openRules(m[1]);
    bar.querySelector('.srt').onclick = () => {
      const parent = data[0]?.it.parentElement;
      if (!parent) return;
      // самые горящие — наверх (закреплённые у XenForo в отдельной группе, их не трогаем)
      [...data].reverse().forEach((d) => { if (d.it.parentElement === parent) parent.prepend(d.it); });
      bar.querySelector('.srt').textContent = '✓ Отсортировано';
    };
  })();

  /* ===================== ДАЛЬШЕ — ТОЛЬКО В ТЕМАХ ===================== */

  const threadBase =(location.href.match(/^(https:\/\/forum\.blackrussia\.online\/threads\/[^/]+\.\d+\/)/) || [])[1];
  if (!threadBase) return;

  const sec = Object.keys(SECTIONS).map((id) => qs(`.p-breadcrumbs a[href*=".${id}/"]`) && SECTIONS[id]).find(Boolean);
  if (!sec) return;

  const firstMsg = qs('article.message');
  const post = firstMsg && qs('.message-body .bbWrapper', firstMsg);
  const text = post ? post.innerText : '';
  const author = (qs('.message-name .username', firstMsg) || {}).textContent?.trim() || 'игрок';
  const title = () => {
    const el = qs('.p-title-value');
    if (!el) return '';
    const c = el.cloneNode(true);
    c.querySelectorAll('.label, .label-append, .labelLink').forEach((x) => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  };

  const threadId = (threadBase.match(/\.(\d+)\/$/) || [])[1];
  const authorId = qs('.message-name [data-user-id]', firstMsg)?.getAttribute('data-user-id');
  const RULE = { bio: { copy: '1.4', rw: '2.2' }, sit: { copy: '1.10', rw: '2.4' }, org: { copy: '1.5', rw: '2.5' } }[sec.key];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const token = () => window.XF?.config?.csrf || qs('input[name="_xfToken"]')?.value || '';
  const parseDoc = (h) => new DOMParser().parseFromString(h, 'text/html');
  const RX_OOC = /(?<![А-Яа-яЁёA-Za-z])(админ(?!истрац)[а-яё]*|модер[а-яё]*|сервер[а-яё]*|донат[а-яё]*|лвл|левел[а-яё]*|репорт[а-яё]*|скрипт[а-яё]*|читер[а-яё]*|аккаунт[а-яё]*|никнейм[а-яё]*|форум[а-яё]*|ooc|оос|nonrp|нонрп|\/me|\/do|\/try|\/todo)(?![А-Яа-яЁёA-Za-z])/gi;
  const RX_MIXED = /[А-Яа-яЁё]+[A-Za-z]+[А-Яа-яЁёA-Za-z]*|[A-Za-z]+[А-Яа-яЁё]+[А-Яа-яЁёA-Za-z]*/g;

  // Результаты поиска XenForo -> [{id, href, title, label, minor, user}]
  function searchResults(d) {
    return [...d.querySelectorAll('li.block-row')].map((li) => {
      const a = li.querySelector('.contentRow-title a[href*="/threads/"]');
      if (!a) return null;
      const href = new URL(a.getAttribute('href'), location.origin).href;
      return {
        id: (href.match(/\.(\d+)\//) || [])[1],
        href: href.replace(/(\/threads\/[^/]+\/).*/, '$1'),
        title: (() => { const c = a.cloneNode(true); c.querySelectorAll('.label').forEach((x) => x.remove());
          return c.textContent.replace(/\s+/g, ' ').replace(/^(Отказано|Одобрено|На рассмотрении|Закрыто)\s*/i, '').trim(); })(),
        label: ((li.querySelector('.contentRow-title .label')?.textContent || '') + ' ' + a.textContent).trim(),
        minor: (li.querySelector('.contentRow-minor')?.textContent || '').replace(/\s+/g, ' ').trim(),
        user: (li.querySelector('.contentRow-minor .username')?.textContent || '').trim(),
      };
    }).filter(Boolean);
  }

  function searchError(d) {
    const e = (d.querySelector('.blockMessage--error, .p-body-pageContent > .blockMessage')?.textContent || '').trim();
    if (/подожд|секунд|wait/i.test(e)) throw new Error('flood');
  }

  async function forumSearch(phrase) {
    const fd = new FormData();
    fd.append('keywords', `"${phrase}"`);
    fd.append('order', 'relevance');
    fd.append('grouped', '1');
    fd.append('_xfToken', token());
    const r = await fetch('/search/search', { method: 'POST', body: fd, credentials: 'same-origin' });
    const d = parseDoc(await r.text());
    searchError(d);
    return searchResults(d);
  }

  // Уникальные фразы из текста (по 8 слов из середины самых длинных предложений)
  function pickPhrases() {
    return text.split(/[.!?…\n]+/)
      .map((s) => s.replace(/^[^:]{0,40}:/, '').match(/[А-Яа-яЁё]+/g) || [])
      .filter((w) => w.length >= 10)
      .sort((a, b) => b.length - a.length)
      .slice(0, 2)
      .map((w) => { const st = Math.floor((w.length - 8) / 2); return w.slice(st, st + 8).join(' '); });
  }
  let copyPhrases = pickPhrases();

  // 1. Копипаст
  async function copyCheck() {
    if (!copyPhrases.length) return { s: 'warn', t: 'Копипаст: мало текста для поиска — проверь через Google' };
    const hits = [];
    for (let i = 0; i < copyPhrases.length; i++) {
      if (i) await sleep(2500);
      hits.push(...(await forumSearch(copyPhrases[i])).filter((h) => h.id !== threadId));
      if (hits.length) break;
    }
    if (!hits.length) return { s: 'ok', t: 'Копипаст: совпадений на форуме нет' };
    const h = hits[0];
    if (h.user && h.user === author) return { s: 'warn', t: `Тот же текст в другой теме автора: «${h.title}»`, link: h.href };
    return { s: 'fail', t: `Копипаст! Совпадение: «${h.title}»${h.user ? ' — ' + h.user : ''}`, link: h.href,
      r: `${sec.what} скопирована у другого игрока: ${h.href} (п. ${RULE.copy}).` };
  }

  // 2. Дубли — другие темы автора
  async function dupCheck() {
    if (sec.key === 'sit') return null;
    if (!authorId) return { s: 'warn', t: 'Дубли: не смог определить автора' };
    const r = await fetch(`/search/member?user_id=${authorId}&content=thread`, { credentials: 'same-origin' });
    const d = parseDoc(await r.text());
    searchError(d);
    const re = sec.key === 'bio' ? /биограф/i : /организац/i;
    const rows = searchResults(d).filter((x) => x.id !== threadId && re.test(x.minor + ' ' + x.title));
    if (!rows.length) return { s: 'ok', t: 'Дубли: других тем автора в разделе нет' };
    // префикс темы важнее названия подраздела
    const st = (x) => /отказ|закрыт/i.test(x.label) ? 'dec' : /одобрен/i.test(x.label) ? 'acc'
      : /отказ/i.test(x.minor) ? 'dec' : /одобрен/i.test(x.minor) ? 'acc' : 'pend';
    const acc = rows.find((x) => st(x) === 'acc');
    const pend = rows.find((x) => st(x) === 'pend');
    if (sec.key === 'bio' && acc && !pend) return { s: 'warn', t: `У автора уже есть одобренная био: «${acc.title}» — проверь, не тот ли персонаж`, link: acc.href };
    if (pend) return { s: 'fail', t: `Дубль: ещё одна тема «${pend.title}»`, link: pend.href,
      r: `Тема является дублем — у вас уже есть тема на рассмотрении: ${pend.href}` };
    if (acc) return { s: 'warn', t: `У автора уже есть одобренная организация: «${acc.title}»`, link: acc.href };
    return { s: 'ok', t: `Дубли: прошлых тем ${rows.length}, все отказаны`, link: rows[0].href };
  }

  // 4. Доработка — последнее сообщение не от автора содержит "доработк"
  function reworkState() {
    const msgs = [...document.querySelectorAll('article.message')];
    const who = (m) => (qs('.message-name .username', m)?.textContent || '').trim();
    const when = (m) => +(qs('time.u-dt', m)?.getAttribute('data-time') || 0);
    const staff = msgs.filter((m) => m !== firstMsg && who(m) !== author);
    const last = staff[staff.length - 1];
    if (!last || !/доработк/i.test(qs('.bbWrapper', last)?.innerText || '')) return null;
    const t = when(last);
    if (!t) return null;
    const edited = +(qs('.message-lastEdit time', firstMsg)?.getAttribute('data-time') || 0) > t;
    const replied = msgs.some((m) => who(m) === author && when(m) > t);
    return { fixed: edited || replied, edited, left: 24 - Math.floor((Date.now() / 1000 - t) / 3600) };
  }

  /* ===================== ПРОВЕРКИ ===================== */
  // { s: 'ok'|'warn'|'fail', t: 'строка в списке', r: 'причина для ответа' }

  function checkFont() {
    if (!post) return null;
    let total = 0, badFont = 0, badSize = 0;
    const walker = document.createTreeWalker(post, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      const len = n.textContent.replace(/\s/g, '').length;
      if (!len) continue;
      total += len;
      const ff = n.parentElement.closest('[style*="font-family"]');
      if (!ff || !FONTS.test(ff.style.fontFamily)) badFont += len;
      const fs = n.parentElement.closest('[style*="font-size"]');
      const px = fs ? parseFloat(fs.style.fontSize) : 0;
      if (!fs || px < MIN_FONT_PX) badSize += len;
    }
    return { total, badFont: badFont / (total || 1), badSize: badSize / (total || 1) };
  }

  async function runChecks() {
    const res = [];
    const words = (text.match(/[A-Za-zА-Яа-яЁё0-9]+/g) || []).length;

    // Заголовок
    if (sec.titleRe.test(title())) res.push({ s: 'ok', t: 'Заголовок по форме' });
    else if (sec.key === 'bio' && /биография\s*[|│¦\/\\:\-–—]+\s*\S/i.test(title()))
      res.push({ s: 'warn', t: `В заголовке не ник формата Имя_Фамилия: «${title().slice(0, 50)}»`,
        r: `Заголовок темы оформлен не по форме — вместо игрового ника указано имя. Правильно: «${sec.titleHint}» (п. 1.1).` });
    else res.push({ s: 'fail', t: `Заголовок не по форме: «${title().slice(0, 50)}»`, r: `Заголовок темы оформлен не по форме. Правильно: «${sec.titleHint}».` });

    // Объём
    if (sec.minWords) {
      if (words < sec.minWords) res.push({ s: 'fail', t: `Мало слов: ${words}/${sec.minWords}`, r: `Недостаточный объём — ${words} слов при минимуме ${sec.minWords} (п. 1.9).` });
      else if (words > sec.maxWords) res.push({ s: 'fail', t: `Много слов: ${words}/${sec.maxWords}`, r: `Превышен максимальный объём — ${words} слов при максимуме ${sec.maxWords} (п. 1.9).` });
      else res.push({ s: 'ok', t: `Объём: ${words} слов` });
    }

    // Пункты формы
    const miss = sec.fields.filter(([, re]) => !re.test(text)).map(([n]) => n);
    res.push(!miss.length
      ? { s: 'ok', t: 'Все пункты формы на месте' }
      : { s: 'fail', t: `Нет пунктов: ${miss.join(', ')}`, r: `Тема составлена не по форме — отсутствуют пункты: ${miss.join(', ')}.` });

    // Шрифт и размер
    const f = checkFont();
    if (f && f.total) {
      const fontRule = sec.key === 'org' ? 'критерии' : 'п. 1.' + (sec.key === 'bio' ? '6' : '9');
      res.push(f.badFont <= 0.1 ? { s: 'ok', t: 'Шрифт Verdana / Times New Roman' }
        : { s: 'fail', t: `Шрифт не тот (${(f.badFont * 100) | 0}% текста)`, r: `Используется неразрешённый шрифт — допустимы только Verdana и Times New Roman (${fontRule}).` });
      res.push(f.badSize <= 0.1 ? { s: 'ok', t: `Размер шрифта ≥ ${MIN_FONT_PX}` }
        : { s: 'fail', t: `Мелкий шрифт (${(f.badSize * 100) | 0}% текста)`, r: `Размер шрифта меньше минимального (${MIN_FONT_PX}) (${fontRule}).` });
    }

    // Фото / видео
    if (sec.needMedia) {
      const embeds = firstMsg ? firstMsg.querySelectorAll('.message-body img:not(.smilie), .message-attachments img, .message-attachments a.file-preview, .bbMediaWrapper, .bbMediaJustifier, iframe, video').length : 0;
      // ссылки: и кликабельные, и просто текстом (https://radikal.host/...)
      const urls = new Set([
        ...(post ? [...post.querySelectorAll('a[href^="http"]')].map((a) => a.href) : []),
        ...(text.match(/https?:\/\/[^\s<>"']+/gi) || []),
      ].filter((u) => !/forum\.blackrussia\.online/i.test(u)));
      const total = embeds + urls.size;
      res.push(total ? { s: 'ok', t: `Фото/видео: ${embeds ? embeds + ' вставлено' : ''}${embeds && urls.size ? ', ' : ''}${urls.size ? urls.size + ' по ссылке' : ''}` }
        : { s: 'fail', t: 'Нет фото/видео', r: `Отсутствуют фото- или видеоматериалы (п. ${sec.mediaRule}).` });
    }

    // Ссылка на исходники (ситуации)
    if (sec.needSourceLink) {
      const links = (post ? [...post.querySelectorAll('a[href]')].filter((a) => !a.href.includes('forum.blackrussia.online/members')).length : 0)
        + (text.match(/https?:\/\/[^\s<>"']+/gi) || []).length;
      res.push(links ? { s: 'ok', t: 'Есть ссылка на исходники' }
        : { s: 'fail', t: 'Нет ссылки на исходники', r: 'Не предоставлена ссылка на исходные материалы с RP отыгровками (п. 1.8).' });
    }

    // Био: ник в заголовке = имя в анкете, возраст
    if (sec.key === 'bio') {
      const nick = (title().match(RX_NICK) || [])[0];
      const nameLine = (text.match(/(?:имя|фио)[^:\n]{0,30}:\s*([^\n]+)/i) || [])[1] || '';
      if (nick && nameLine.trim()) {
        const [n, s] = nick.split('_');
        const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
        const lat = nameLine.toLowerCase().replace(/[а-яё]/g, (c) => TR[c] ?? c).replace(/[^a-z]/g, '');
        const skel = (x) => x.toLowerCase().replace(/[^a-z]/g, '').replace(/[aeiouy]/g, '').replace(/(.)\1+/g, '$1');
        const latSk = skel(lat);
        const near = (w) => lat.includes(w.toLowerCase().slice(0, 3)) || latSk.includes(skel(w).slice(0, 3));
        res.push((nameLine.includes(n) && nameLine.includes(s)) || (near(n) && near(s))
          ? { s: 'ok', t: 'Ник совпадает с именем в анкете' }
          : { s: 'warn', t: `Ник ${nick} ≠ «${nameLine.trim().slice(0, 30)}»` });
      }
      const age = +((text.match(/возраст[^:\n]*:\s*(\d{1,3})/i) || [])[1] || NaN);
      if (isNaN(age)) res.push({ s: 'warn', t: 'Возраст не указан числом' });
      else if (age < 14 || age > 90) res.push({ s: 'warn', t: `Сомнительный возраст: ${age}` });
      else if (age < 21 && /университет|институт|высше[ег]о|бизнес|миллион|диплом/i.test(text))
        res.push({ s: 'fail', t: `Возраст ${age}, а пишет про вуз/бизнес`, r: `Логическое противоречие: возраст персонажа (${age}) не соответствует описанным событиям (п. 1.10).` });
      else res.push({ s: 'ok', t: `Возраст: ${age}` });
    }

    // Орг: состав, госфракция, биография лидера
    if (sec.key === 'org') {
      const nicks = new Set(text.match(new RegExp(RX_NICK.source, 'g')) || []);
      res.push(nicks.size >= sec.minMembers ? { s: 'ok', t: `Участников: ${nicks.size}` }
        : { s: 'fail', t: `Участников: ${nicks.size}/${sec.minMembers}`, r: `Недостаточный состав участников — минимум ${sec.minMembers} человека.` });

      if (/росгвард|\bмвд\b|\bфсб\b|гибдд|дпс|полици|армия|\bвч\b|фсин|мчс|правительств|прокуратур/i.test(title() + ' ' + (text.match(/название[^\n]*\n?[^\n]*/i) || [''])[0]))
        res.push({ s: 'warn', t: 'Похоже на госфракцию — проверь (п. 1.6)' });

      const bioLink = post && [...post.querySelectorAll('a[href*="forum.blackrussia.online/threads/"]')].map((a) => a.href)[0];
      if (!bioLink) res.push({ s: 'fail', t: 'Нет ссылки на биографию лидера', r: 'Отсутствует ссылка на одобренную RP биографию лидера.' });
      else {
        try {
          const html = await (await fetch(bioLink, { credentials: 'same-origin' })).text();
          const d = new DOMParser().parseFromString(html, 'text/html');
          const pref = (d.querySelector('.p-title-value .label')?.textContent || '').trim();
          const inBio = !!d.querySelector('.p-breadcrumbs a[href*=".2186/"]');
          if (!inBio) res.push({ s: 'warn', t: 'Ссылка ведёт не в раздел биографий' });
          else if (/одобрен/i.test(pref)) res.push({ s: 'ok', t: 'Биография лидера одобрена' });
          else res.push({ s: 'fail', t: `Биография лидера: «${pref || 'без префикса'}»`, r: 'RP биография лидера не одобрена.' });
        } catch { res.push({ s: 'warn', t: 'Не смог открыть биографию лидера' }); }
      }
    }

    // OOC-информация
    const ooc = [...new Set((text.match(RX_OOC) || []).map((w) => w.trim().toLowerCase()))];
    res.push(!ooc.length ? { s: 'ok', t: 'Без OOC-слов' }
      : { s: 'warn', t: `OOC-слова: ${ooc.slice(0, 6).join(', ')} — проверь${sec.key === 'sit' ? ' (п. 1.1)' : ''}` });

    // Сверхъестественное
    const sup = text.match(RX_SUPER);
    res.push(sup ? { s: 'warn', t: `Есть «${sup[0]}…» — глянь на нереалистичность` } : { s: 'ok', t: 'Без сверхъестественного' });

    // Капс
    const letters = text.replace(/[^A-Za-zА-Яа-яЁё]/g, '');
    const caps = letters ? letters.replace(/[^A-ZА-ЯЁ]/g, '').length / letters.length : 0;
    res.push(caps < 0.3 ? { s: 'ok', t: 'Без капса' }
      : { s: 'fail', t: `Капс ${(caps * 100) | 0}%`, r: 'Текст нечитабелен — написан с использованием CapsLock.' });

    // Грамотность (эвристика)
    const err = (text.match(/[.!?]\s+[а-яё]/g) || []).length + (text.match(/[а-яё][,.!?][а-яё]/gi) || []).length;
    res.push(err <= 3 ? { s: 'ok', t: 'Явных ошибок оформления нет' }
      : { s: 'warn', t: `Похоже на ошибки (${err}) — проверь глазами` });

    // Смешанные буквы (латиница внутри русских слов — обход антиплагиата)
    const mixed = (text.match(RX_MIXED) || []).length;
    res.push(!mixed ? { s: 'ok', t: 'Без подмены букв' }
      : { s: 'warn', t: `Латиница внутри русских слов: ${mixed} — признак обхода антиплагиата` });

    // Подозрения -> подходящая причина отказа (номер из MANUAL или свой текст)
    const WARN_R = [
      [/нереалистичн/i, { bio: 0, sit: 2 }],
      [/OOC-слова/i, { sit: 0, bio: 'В биографии присутствует OOC-информация.', org: 'В заявке присутствует OOC-информация.' }],
      [/Похоже на ошибки/i, { bio: 3, sit: 1, org: 8 }],
      [/Латиница внутри/i, { bio: 2, sit: 4, org: 4 }],
      [/госфракц/i, { org: 5 }],
      [/≠/, { bio: 'Имя и фамилия персонажа не совпадают с ником в заголовке (п. 1.1).' }],
      [/Сомнительный возраст/i, { bio: 5 }],
      [/не в раздел биографий/i, { org: 'Ссылка на RP биографию лидера ведёт не на одобренную биографию.' }],
    ];
    for (const c of res) {
      if (c.s !== 'warn' || c.r) continue;
      const hit = WARN_R.find(([re]) => re.test(c.t));
      const v = hit && hit[1][sec.key];
      if (v != null) c.r = typeof v === 'number' ? MANUAL[sec.key][v] : v;
    }

    return res;
  }

  // Причины, которые скрипт сам не ловит — ставятся галочкой вручную
  const MANUAL = {
    bio: [
      'Персонаж обладает сверхспособностями — биография нереалистична (п. 1.2).',
      'Биография существующего человека (п. 1.3).',
      'Биография скопирована у другого игрока (п. 1.4).',
      'Большое количество грамматических и орфографических ошибок (п. 1.5).',
      'Биография содержит факторы, позволяющие нарушать правила сервера (п. 1.8).',
      'В биографии есть логические противоречия (п. 1.10).',
    ],
    sit: [
      'В ситуации присутствует OOC-информация (п. 1.1).',
      'Большое количество грамматических и пунктуационных ошибок (п. 1.2).',
      'Ситуация неправдоподобна / содержит сверхъестественные явления (п. 1.3).',
      'Скриншоты содержат OOC-информацию или интерфейс (п. 1.6).',
      'Ситуация скопирована у другого игрока (п. 1.10).',
      'Нарушены правила форума (п. 1.11).',
      'Ситуация противоречит игровой логике и здравому смыслу (п. 2.2).',
    ],
    org: [
      'Нет чёткого рода деятельности или истории организации.',
      'Отсутствует отличительная визуальная особенность.',
      'Деятельность организации нарушает правила проекта (п. 1.1).',
      'Нарушены правила форума (п. 1.4).',
      'Организация скопирована / воссоздана ранее распущенная (п. 1.5).',
      'Организация создана в форме государственной фракции (п. 1.6).',
      'Название не отражает тематику организации (п. 1.9).',
      'Скриншоты содержат OOC-информацию или интерфейс (п. 1.10).',
      'Описание составлено неграмотно / нечитабельно.',
      'Организация противоречит игровой логике и здравому смыслу (п. 2.2).',
    ],
  };

  /* ===================== ОТВЕТЫ ===================== */

  const G = 'rgb(0, 200, 83)', R = 'rgb(255, 60, 60)', Y = 'rgb(255, 170, 0)';
  const hello = `[CENTER]Здравствуйте, ${authorId ? `[USER=${authorId}]${author}[/USER]` : author}.[/CENTER]<br>`;
  const list = (rs) => `[LIST]<br>${rs.map((r) => `[*]${r}`).join('<br>')}<br>[/LIST]<br>`;

  const T = {
    accept: () => `${hello}[CENTER]Требования соблюдены.[/CENTER]<br>[CENTER][COLOR=${G}][B]${sec.what} одобрена.[/B][/COLOR][/CENTER]`
      + (sec.key === 'org' ? `<br>[CENTER]Тема остаётся открытой — публикуйте отчёты о деятельности по форме. Если в течение недели от лидера не будет сообщений, организация будет считаться распущенной.[/CENTER]` : '') + signature(),
    decline: (rs) => `${hello}[CENTER]Требования не соблюдены:[/CENTER]<br>${list(rs)}[CENTER][COLOR=${R}][B]${sec.what} отказана.[/B][/COLOR][/CENTER]` + signature(),
    rework: (rs) => `${hello}[CENTER]Тема оставлена на доработку. Необходимо исправить:[/CENTER]<br>${list(rs)}[CENTER]На внесение изменений даётся 24 часа. Если тема не будет отредактирована за это время, она будет отказана.[/CENTER]<br>[CENTER][COLOR=${Y}][B]На доработке.[/B][/COLOR][/CENTER]` + signature(),
    dissolve: (days) => `${hello}[CENTER]В течение ${days} дней в теме не было отчётов от лидера о деятельности организации.[/CENTER]<br>[CENTER]Согласно п. 1.2 и 2.6 правил, организация считается распущенной, тема закрывается.[/CENTER]<br>[CENTER][COLOR=${R}][B]Организация распущена.[/B][/COLOR][/CENTER]` + signature(),
    remind: () => `${hello}[CENTER]Напоминаем: лидер обязан публиковать отчёты о деятельности организации по форме. Если в течение недели в теме не будет сообщений от лидера, организация будет считаться распущенной (п. 1.2).[/CENTER]<br>[CENTER][COLOR=${Y}][B]Ожидаем отчёт.[/B][/COLOR][/CENTER]` + signature(),
    watch: () => `${hello}[CENTER]Ваша тема взята на рассмотрение. Ожидайте ответа.[/CENTER]<br>[CENTER][COLOR=${Y}][B]На рассмотрении.[/B][/COLOR][/CENTER]` + signature(),
  };

  /* ===================== ДЕЙСТВИЯ ===================== */

  function insertReply(html) {
    const fr = qs('.js-quickReply .fr-element') || qs('.fr-element');
    if (fr) {
      qs('.js-quickReply .fr-placeholder')?.remove();
      fr.innerHTML = html.split('<br>').map((l) => `<p>${l || '<br>'}</p>`).join('');
      fr.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    const ta = qs('textarea[name="message"]');
    if (ta) { ta.value = html.replaceAll('<br>', '\n'); return true; }
    return false;
  }

  async function currentPrefix() {
    try {
      const d = parseDoc(await (await fetch(threadBase + 'edit', { credentials: 'same-origin' })).text());
      learnPrefixes(d);
      return d.querySelector('select[name="prefix_id"] option[selected], input[name="prefix_id"]:checked')?.value || '';
    } catch { return ''; }
  }

  async function editThread({ prefix, close, sticky }) {
    const fd = new FormData();
    fd.append('title', title());
    const pf = prefix ?? (await currentPrefix());
    if (pf) fd.append('prefix_id', pf);
    fd.append('_xfSet[discussion_open]', '1');
    if (!close) fd.append('discussion_open', '1');
    fd.append('_xfSet[sticky]', '1');
    if (sticky) fd.append('sticky', '1');
    fd.append('_xfToken', window.XF?.config?.csrf || qs('input[name="_xfToken"]')?.value || '');
    fd.append('_xfRequestUri', location.pathname);
    fd.append('_xfWithData', '1');
    fd.append('_xfResponseType', 'json');
    const r = await fetch(threadBase + 'edit', { method: 'POST', body: fd, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (j.status && j.status !== 'ok') throw new Error((j.errors || []).join(', ') || 'не удалось изменить тему');
  }

  let pending = null;
  const moveTarget = (kind) => kind && ls.get('move', true) ? (ls.get('move_map', {})[sec.id] || {})[kind] : null;
  const sendLabel = (o) => '📨 Отправить' + (o.close ? ' + закрыть' : '') + (o.sticky ? ' + закрепить' : '') + (moveTarget(o.move) ? ' + перенести' : '');

  async function moveThread(nodeId) {
    const fd = new FormData();
    fd.append('target_node_id', nodeId);
    fd.append('redirect_type', 'none');
    fd.append('notify_watchers', '0');
    fd.append('starter_alert', '0');
    fd.append('_xfToken', token());
    fd.append('_xfRequestUri', location.pathname);
    fd.append('_xfWithData', '1');
    fd.append('_xfResponseType', 'json');
    const r = await fetch(threadBase + 'move', { method: 'POST', body: fd, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (j.status && j.status !== 'ok') throw new Error((j.errors || []).join(', ') || 'не удалось перенести тему');
  }
  async function choose(html, opts) {
    pending = opts;
    if (ls.get('auto_send', false)) {
      if (!insertReply(html)) return toast('Не нашёл поле ответа');
      return finish();
    }
    if (ls.get('preview', true)) return openPreview(html, opts);
    if (!insertReply(html)) return toast('Не нашёл поле ответа');
    showSend(sendLabel(opts));
    toast('Ответ вставлен — проверь и жми «Отправить»');
  }

  async function goNext() {
    toast('Ищу следующую тему…');
    try {
      const q = (await fetchQueue(sec.id)).filter((x) => x.id !== threadId);
      if (!q.length) return toast('Очередь пуста 🎉');
      location.href = q[0].href;
    } catch { toast('Не удалось получить очередь'); }
  }

  async function finish() {
    if (!pending) return;
    try {
      qs('.js-quickReply button[type="submit"]')?.click();
      await new Promise((r) => setTimeout(r, 1500));
      await editThread(pending);
      if (pending.move && ls.get('move', true)) {
        if (!moveTarget(pending.move)) { try { await fetchQueue(sec.id); } catch {} }
        const t = moveTarget(pending.move);
        if (t) { await moveThread(t.id); toast(`Перенесено в «${t.name}»`); await new Promise((r) => setTimeout(r, 700)); }
      }
      toast('Готово ✔');
      if (ls.get('auto_next', false)) setTimeout(goNext, 600);
      else setTimeout(() => location.reload(), 800);
    } catch (e) { toast('Ошибка: ' + e.message); }
  }

  /* ===================== ИНТЕРФЕЙС ===================== */

  const css = document.createElement('style');
  css.textContent = `
    #brc{--g:#22c58b;--r:#ff5c6c;--y:#ffb547;--b:#40c4d3;--card:#12191c;--card2:#182125;--line:#ffffff10;--txt:#e9eff1;--mut:#8796a0;
      position:relative;margin:16px 0;border-radius:20px;background:var(--card);border:1px solid #ffffff12;
      box-shadow:0 1px 0 #ffffff08 inset,0 18px 40px -12px #000c;font:14px/1.45 -apple-system,'SF Pro Text',Segoe UI,Roboto,sans-serif;color:var(--txt);overflow:hidden}
    #brc::before{content:'';position:absolute;inset:0 0 auto 0;height:3px;background:linear-gradient(90deg,var(--accent,#40c4d3),transparent)}
    #brc svg.i{width:18px;height:18px;flex:none;fill:none!important;stroke:currentColor!important;stroke-width:2!important;stroke-linecap:round;stroke-linejoin:round}
    #brc svg.i *{fill:none!important;stroke:currentColor!important}
    #brc .in{padding:16px}
    #brc .hd{display:flex;align-items:center;gap:14px}
    #brc .ring{position:relative;width:58px;height:58px;flex:none}
    #brc .ring svg{transform:rotate(-90deg)}
    #brc .ring svg,#brc .ring svg *{fill:none!important}
    #brc .ring b{position:absolute;inset:0;display:grid;place-items:center;font-size:15px;font-weight:800;letter-spacing:-.02em}
    #brc .ttl{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--mut);font-weight:700}
    #brc .vrd{font-size:18px;font-weight:800;margin-top:1px;letter-spacing:-.01em}
    #brc .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
    #brc .chip{display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700;background:#ffffff0a;color:var(--mut)}
    #brc .chip svg.i{width:13px;height:13px}
    #brc .chip.g{color:var(--g);background:#22c58b18}#brc .chip.y{color:var(--y);background:#ffb54718}#brc .chip.r{color:var(--r);background:#ff5c6c18}#brc .chip.t{color:var(--b);background:#40c4d318}
    #brc .chip.late{color:#fff;background:var(--r)}
    #brc .tog{margin-left:auto;align-self:flex-start;width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:#ffffff08;border:none;color:var(--mut);cursor:pointer;transition:transform .25s}
    #brc.min .tog{transform:rotate(180deg)}
    #brc.min .body{display:none}

    #brc .acts{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:16px}
    #brc .acts.two{grid-template-columns:1fr 1fr}
    #brc .a{display:flex;align-items:center;justify-content:center;gap:7px;min-height:46px;padding:10px 8px;border-radius:14px;border:1px solid transparent;
      font-weight:750;font-size:13.5px;cursor:pointer;transition:transform .12s,background .2s,box-shadow .2s;line-height:1.15;text-align:left}
    #brc .a span{display:none}
    #brc .a:active{transform:scale(.97)}
    #brc .a.ok{color:var(--g);background:#22c58b14;border-color:#22c58b33}
    #brc .a.no{color:var(--r);background:#ff5c6c14;border-color:#ff5c6c33}
    #brc .a.wt{color:var(--y);background:#ffb54714;border-color:#ffb54733}
    #brc .a.rec.ok{color:#04140d;background:linear-gradient(135deg,#2fd89a,#16a874);box-shadow:0 8px 20px -6px #22c58b99;border-color:transparent}
    #brc .a.rec.no{color:#fff;background:linear-gradient(135deg,#ff6b7a,#e0384b);box-shadow:0 8px 20px -6px #ff5c6c99;border-color:transparent}
    #brc .a[disabled]{color:#ffffff40;background:#ffffff06;border-color:#ffffff0a;cursor:not-allowed;box-shadow:none}
    #brc .a.on{box-shadow:0 0 0 2px #ffffff40}

    #brc .tools{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;margin-top:10px;border-radius:14px;background:var(--card2);border:1px solid var(--line);overflow:hidden}
    #brc .tb{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:9px 2px 8px;border:none;background:none;color:var(--mut)!important;font:650 11px/1.2 -apple-system,'SF Pro Text',Segoe UI,Roboto,sans-serif!important;cursor:pointer;text-decoration:none!important;position:relative}
    #brc .tb + .tb::before{content:'';position:absolute;left:0;top:22%;bottom:22%;width:1px;background:var(--line)}
    #brc .tb svg.i{width:19px;height:19px;color:var(--txt)}
    #brc .tb:active{background:#ffffff08}
    #brc .tb.on,#brc .tb.on svg.i{color:var(--b)}
    #brc .legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;font-size:11px}

    #brc .sec{margin-top:16px}
    #brc .sh{font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.08em;margin:0 4px 8px;display:flex;justify-content:space-between;align-items:center;cursor:pointer}
    #brc .lst{border-radius:16px;background:var(--card2);border:1px solid var(--line);overflow:hidden}
    #brc .it{display:flex;gap:12px;align-items:center;padding:11px 12px}
    #brc .it + .it{border-top:1px solid var(--line)}
    #brc .ic{width:28px;height:28px;border-radius:9px;flex:none;display:grid;place-items:center}
    #brc .ic svg.i{width:16px;height:16px}
    #brc .fail .ic{background:#ff5c6c1f;color:var(--r)}#brc .warn .ic{background:#ffb5471f;color:var(--y)}#brc .ok .ic{background:#22c58b1f;color:var(--g)}#brc .it.load .ic{background:#40c4d31a;color:var(--b)}
    #brc .it .tx{flex:1;min-width:0}
    #brc .lnk{flex:none;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#40c4d314;color:var(--b)}
    #brc .okl{display:none}#brc .okl.open{display:block}
    #brc .sh .cnt{display:inline-flex;align-items:center;gap:4px;color:var(--b);text-transform:none;letter-spacing:0;font-weight:700}

    #brc .rs{display:none;margin-top:12px;padding:12px;border-radius:16px;background:var(--card2);border:1px solid #ff5c6c33}
    #brc .rs.open{display:block;animation:brcin .2s}
    @keyframes brcin{from{opacity:0;transform:translateY(-4px)}}
    #brc .rs .sub{font-size:11px;color:var(--mut);margin:12px 2px 6px;font-weight:800;letter-spacing:.07em}
    #brc .rs .sub:first-child{margin-top:0}
    #brc .ck{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border-radius:11px;margin-bottom:2px;cursor:pointer}
    #brc .ck:hover{background:#ffffff06}
    #brc .ck input{display:none}
    #brc .ck i{width:20px;height:20px;border-radius:6px;border:2px solid #ffffff30;flex:none;margin-top:0;display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900;transition:.15s}
    #brc .ck input:checked + i{background:var(--r);border-color:var(--r);color:#fff}
    #brc .ck input:checked + i::after{content:'✓'}
    #brc .ck em.au{font-style:normal;font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;background:#40c4d322;color:var(--b);vertical-align:1px}
    #brc .a .nb{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ffffff26;font-size:11px;color:inherit}
    #brc .ck .del{margin-left:auto;background:none;border:none;color:var(--mut);font-size:18px;line-height:1;cursor:pointer}
    #brc .addr{display:flex;gap:6px;margin-top:10px}
    #brc .addr input{flex:1;min-width:0;padding:10px 12px;border-radius:11px;border:1px solid var(--line);background:#0b1013;color:var(--txt);font-size:13px}
    #brc .addr button{width:42px;border:none;border-radius:11px;background:var(--b);color:#062326;cursor:pointer;display:grid;place-items:center}
    #brc .rsb{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}

    #brc .bn{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:14px;padding:12px 14px;border-radius:14px;font-weight:600}
    #brc .bn > div{display:flex;gap:8px;align-items:center;flex:1}
    #brc .bn.r{background:#ff5c6c14;color:#ffc2c8;border:1px solid #ff5c6c33}#brc .bn.y{background:#ffb54714;color:#ffe0ad;border:1px solid #ffb54733}#brc .bn.t{background:#40c4d314;color:#bdeff5;border:1px solid #40c4d333}
    #brc .bn .a{flex:1 1 100%}

    #brc .send{display:none;width:100%;margin-top:14px;padding:14px;border:none;border-radius:14px;font-weight:800;font-size:15px;color:#fff;
      background:linear-gradient(135deg,#40c4d3,#22c58b);box-shadow:0 10px 24px -8px #22c58baa;cursor:pointer}
    #brc .ft{margin-top:14px;font-size:11px;color:#ffffff38;text-align:center}
    #brc .load{display:flex;align-items:center;gap:10px;color:var(--mut)}
    #brc .sp{width:16px;height:16px;border-radius:50%;border:2px solid #40c4d340;border-top-color:#40c4d3;animation:brcsp .8s linear infinite;display:inline-block}
    @keyframes brcsp{to{transform:rotate(360deg)}}

    mark.brc-m{color:inherit;border-radius:3px;padding:0 1px}
    mark.brc-m.copy{background:#a66bff55;outline:1px solid #a66bff}
    mark.brc-m.mix{background:#ff546866;outline:1px solid #ff5468}
    mark.brc-m.caps{background:#ff8a3d55}
    mark.brc-m.low{background:#ffb54755}
    mark.brc-m.sp{background:#ffe14755}
    mark.brc-m.sup{background:#3ec6d055}
    mark.brc-m.ooc{background:#ff7ad955;outline:1px solid #ff7ad9}
    #brc-pv{position:fixed;inset:0;z-index:100003;background:#000a;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(3px);
      font:14px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#e6edf0;animation:brcfade .2s}
    @keyframes brcfade{from{opacity:0}}
    #brc-pv .md{width:100%;max-width:560px;max-height:92vh;overflow:auto;background:#11181b;border:1px solid #3ec6d055;border-radius:22px 22px 0 0;padding:16px;
      box-shadow:0 -10px 40px #000c;animation:brcup .25s}
    @media(min-width:600px){#brc-pv{align-items:center}#brc-pv .md{border-radius:22px}}
    @keyframes brcup{from{transform:translateY(40px)}}
    #brc-pv .hd2{display:flex;align-items:center;gap:10px;margin-bottom:12px}
    #brc-pv .hd2 b{font-size:16px;flex:1}
    #brc-pv .x{background:#ffffff14;border:none;color:#e6edf0;width:34px;height:34px;border-radius:10px;font-size:18px;cursor:pointer}
    #brc-pv .tabs{display:flex;gap:6px;margin-bottom:10px}
    #brc-pv .tab{flex:1;padding:8px;border-radius:10px;border:1px solid #ffffff14;background:#ffffff08;color:#8b9aa1;font-weight:700;cursor:pointer}
    #brc-pv .tab.on{color:#3ec6d0;border-color:#3ec6d0}
    #brc-pv .view{padding:16px;border-radius:14px;background:#2a3236;min-height:120px}
    #brc-pv .view ul{margin:8px 0;padding-left:22px;text-align:left}
    #brc-pv .view a{color:#3ec6d0;word-break:break-all}
    #brc-pv textarea{width:100%;box-sizing:border-box;min-height:220px;padding:12px;border-radius:14px;border:1px solid #ffffff22;background:#0b1012;color:#e6edf0;
      font:13px/1.5 ui-monospace,Menlo,Consolas,monospace;resize:vertical}
    #brc-pv .meta2{margin-top:10px;font-size:12px;color:#8b9aa1}
    #brc-pv .bt{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
    #brc-pv .bt button{padding:13px;border:none;border-radius:12px;font-weight:800;font-size:14px;cursor:pointer;color:#e6edf0;background:#ffffff12}
    #brc-pv .bt .go{grid-column:1/-1;background:linear-gradient(135deg,#3ec6d0,#1ec27a);color:#fff;box-shadow:0 6px 18px #1ec27a44}
    #brc-toast{position:fixed;left:50%;bottom:100px;transform:translateX(-50%) translateY(20px);opacity:0;transition:.25s;
      background:#11181bf2;color:#e6edf0;border:1px solid #3ec6d066;padding:10px 16px;border-radius:12px;z-index:100002;
      box-shadow:0 8px 24px #000a;font:600 13px -apple-system,Segoe UI,Roboto,sans-serif;pointer-events:none}
    #brc-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
  `;
  document.head.appendChild(css);

  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    hour: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4A2 2 0 0 0 7 17.8V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4A2 2 0 0 0 17 6.2V2"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    next: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
    ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    mega: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    snow: '<path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  };
  const I = (n) => `<svg class="i" viewBox="0 0 24 24">${ICONS[n] || ''}</svg>`;

  const box = document.createElement('div');
  box.id = 'brc';
  box.innerHTML = `<div class="in"><div class="load"><i class="sp"></i>Проверяю тему…</div></div>`;
  const quick = qs('.js-quickReply');
  if (quick) quick.after(box);
  else (qs('.block--messages') || document.body).after(box);

  const toastEl = document.createElement('div');
  toastEl.id = 'brc-toast';
  document.body.appendChild(toastEl);
  function toast(m) {
    toastEl.textContent = m;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 3. предпросмотр ответа ---------- */
  function bbToHtml(raw) {
    let h = raw.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    h = h.replace(/\[LIST\]\s*([\s\S]*?)\[\/LIST\]/gi, (m, b) => '<ul>' + b.split(/\[\*\]/).filter((x) => x.trim()).map((x) => `<li>${x.trim()}</li>`).join('') + '</ul>');
    h = h.replace(/\[CENTER\]([\s\S]*?)\[\/CENTER\]/gi, '<div style="text-align:center">$1</div>')
      .replace(/\[RIGHT\]([\s\S]*?)\[\/RIGHT\]/gi, '<div style="text-align:right">$1</div>')
      .replace(/\[COLOR=([^\]]+)\]([\s\S]*?)\[\/COLOR\]/gi, '<span style="color:$1">$2</span>')
      .replace(/\[B\]([\s\S]*?)\[\/B\]/gi, '<b>$1</b>')
      .replace(/\[I\]([\s\S]*?)\[\/I\]/gi, '<i>$1</i>')
      .replace(/\[USER(?:=\d+)?\]([\s\S]*?)\[\/USER\]/gi, '<span style="color:#3ec6d0;font-weight:600">$1</span>')
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
    return h.replace(/\n(?=<\/?(ul|li|div))/g, '').replace(/(<\/(ul|li|div)>)\n/g, '$1').replace(/\n/g, '<br>');
  }

  function openPreview(html, opts) {
    document.getElementById('brc-pv')?.remove();
    const raw = html.replaceAll('<br>', '\n');
    const pv = document.createElement('div');
    pv.id = 'brc-pv';
    pv.innerHTML = `<div class="md">
      <div class="hd2"><b>Предпросмотр ответа</b><button class="x" title="Закрыть">✕</button></div>
      <div class="tabs"><button class="tab on" data-t="v">👁 Как увидят</button><button class="tab" data-t="e">✏️ Править текст</button></div>
      <div class="view"></div>
      <textarea style="display:none"></textarea>
      <div class="meta2">${[opts.prefix ? 'префикс будет изменён' : '', opts.close ? 'тема будет закрыта' : 'тема останется открытой', opts.sticky ? 'тема будет закреплена' : '', moveTarget(opts.move) ? `перенос в «${moveTarget(opts.move).name}»` : ''].filter(Boolean).join(' · ')}</div>
      <div class="bt">
        <button class="go">${sendLabel(opts)}</button>
        <button class="ed">📝 В редактор</button>
        <button class="cn">Отмена</button>
      </div></div>`;
    document.body.appendChild(pv);
    const view = qs('.view', pv), ta = qs('textarea', pv);
    ta.value = raw;
    const upd = () => (view.innerHTML = bbToHtml(ta.value));
    upd();
    ta.oninput = upd;
    pv.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
      pv.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
      const e = t.dataset.t === 'e';
      ta.style.display = e ? 'block' : 'none';
      view.style.display = e ? 'none' : 'block';
    }));
    const close = () => pv.remove();
    qs('.x', pv).onclick = close;
    qs('.cn', pv).onclick = close;
    pv.onclick = (e) => { if (e.target === pv) close(); };
    const put = () => insertReply(ta.value.replaceAll('\n', '<br>'));
    qs('.ed', pv).onclick = () => {
      if (!put()) return toast('Не нашёл поле ответа');
      close(); showSend(sendLabel(opts)); toast('Текст в редакторе — жми «Отправить» в панели');
    };
    qs('.go', pv).onclick = () => {
      if (!put()) return toast('Не нашёл поле ответа');
      close(); finish();
    };
  }

  /* ---------- 5. контроль одобренной организации ---------- */
  const orgApproved = sec.key === 'org' && /одобрен/i.test(qs('.p-title-value .label')?.textContent || '');

  async function orgControl() {
    box.innerHTML = `<div class="in"><div class="load"><i class="sp"></i>Смотрю отчёты организации…</div></div>`;
    let d = document;
    try { d = parseDoc(await (await fetch(threadBase + 'page-9999', { credentials: 'same-origin' })).text()); } catch {}
    const firstId = firstMsg?.getAttribute('data-content');
    const who = (m) => (qs('.message-name .username', m)?.textContent || '').trim();
    const when = (m) => +(qs('time.u-dt', m)?.getAttribute('data-time') || 0);
    const txt = (m) => qs('.bbWrapper', m)?.innerText || '';
    const msgs = [...d.querySelectorAll('article.message')].filter((m) => !firstId || m.getAttribute('data-content') !== firstId);
    const lead = msgs.filter((m) => who(m) === author);
    const now = Date.now() / 1000;
    const isFreeze = (m) => /замороз|заморож/i.test(txt(m));

    const lastT = lead.length ? Math.max(...lead.map(when)) : 0;
    const approvedMsg = msgs.find((m) => who(m) !== author && /одобрен/i.test(txt(m)));
    const base = lastT || (approvedMsg && when(approvedMsg)) || when(firstMsg);
    const days = Math.floor((now - base) / 86400);
    const fr = lead.filter(isFreeze).map(when).sort((a, b) => b - a)[0];
    const frozenLeft = fr ? Math.ceil((fr + 14 * 86400 - now) / 86400) : 0;
    const frozen = frozenLeft > 0;
    const dead = days >= 7 && !frozen;

    const reports = lead.filter((m) => !isFreeze(m)).slice(-5).reverse().map((m) => {
      const t = txt(m);
      const miss = [['дата', /дата/i], ['описание', /описани/i], ['состав', /состав|участник/i]].filter(([, re]) => !re.test(t)).map(([n]) => n);
      const proof = m.querySelector('.bbWrapper img:not(.smilie), .bbMediaWrapper, iframe, .message-attachments, .bbWrapper a[href^="http"]') || /https?:\/\//.test(t);
      if (!proof) miss.push('доказательства');
      const dt = new Date(when(m) * 1000).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      return miss.length ? { s: 'warn', t: `Отчёт ${dt}: нет — ${miss.join(', ')}` } : { s: 'ok', t: `Отчёт ${dt}: по форме` };
    });

    const col = dead ? 'var(--r)' : frozen ? 'var(--b)' : days >= 5 ? 'var(--y)' : 'var(--g)';
    const verdict = dead ? `Нет отчётов ${days} дн` : frozen ? `Заморожена ещё ${frozenLeft} дн` : lastT ? 'Организация активна' : 'Отчётов пока нет';
    const item = (c) => `<div class="it ${c.s}"><div class="ic">${I({ ok: 'check', warn: 'alert', fail: 'x' }[c.s])}</div><div class="tx">${esc2(c.t)}</div></div>`;
    box.style.setProperty('--accent', dead ? '#ff5c6c' : frozen ? '#40c4d3' : days >= 5 ? '#ffb547' : '#22c58b');

    box.innerHTML = `<div class="in">
      <div class="hd">
        <div class="ring" style="display:grid;place-items:center;border-radius:50%;border:5px solid ${col}"><b style="color:${col};position:static;font-size:13px;text-align:center;line-height:1.1">${frozen ? I('snow') : days + '<br>дн'}</b></div>
        <div>
          <div class="ttl">Контроль организации</div>
          <div class="vrd" style="color:${col}">${verdict}</div>
          <div class="chips">
            <span class="chip t">${I('user')}${esc2(author)}</span>
            <span class="chip ${dead ? 'r' : 'g'}">${I('clock')}${lastT ? `отчёт ${days} дн назад` : 'отчётов не было'}</span>
            ${frozen ? `<span class="chip t">${I('snow')}до ${new Date((fr + 14 * 86400) * 1000).toLocaleDateString('ru-RU')}</span>` : ''}
          </div>
        </div>
        <button class="tog" title="Свернуть">${I('down')}</button>
      </div>
      <div class="body">
        ${dead ? `<div class="bn r"><div>${I('clock')}<span><b>Неделя без отчётов</b> — по п. 1.2 и 2.6 можно распускать</span></div></div>` : ''}
        <div class="acts two">
          <button class="a no ${dead ? 'rec' : ''}" id="brc-diss" ${dead ? '' : 'disabled title="Ещё не прошло 7 дней"'}>${I('ban')}Распустить</button>
          <button class="a wt" id="brc-rem">${I('mega')}Напомнить</button>
        </div>
        <div class="sec"><div class="sh">Последние отчёты лидера</div><div class="lst">${reports.length ? reports.map(item).join('') : `<div class="it warn"><div class="ic">${I('alert')}</div><div class="tx">На последней странице темы нет сообщений от лидера</div></div>`}</div></div>
        <button class="send" id="brc-send" style="display:none"></button>
        <div class="ft">Скрипт кураторов · v${VERSION} · заморозка 2 нед. раз в месяц (п. 1.3)</div>
      </div></div>`;
    if (ls.get('min', false)) box.classList.add('min');
    qs('.tog', box).onclick = () => { box.classList.toggle('min'); ls.set('min', box.classList.contains('min')); };
    qs('#brc-send', box).onclick = finish;
    qs('#brc-diss', box).onclick = () => choose(T.dissolve(days), { close: true, sticky: false, move: 'arc' });
    qs('#brc-rem', box).onclick = () => choose(T.remind(), { close: false, sticky: true });
  }

  /* ---------- состояние ---------- */
  const esc2 = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const manual = MANUAL[sec.key];
  const custKey = 'custom_' + sec.key;
  const getCust = () => ls.get(custKey, []);
  const SHARED_URL = UPDATE_URL.replace(/[^/]+$/, 'reasons.json');
  const getShared = () => (ls.get('shared', { data: {} }).data || {})[sec.key] || [];
  (async () => {
    const c = ls.get('shared', null);
    if (c && Date.now() - c.ts < 60 * 60e3) return;
    try {
      const data = await (await fetch(SHARED_URL + '?t=' + Date.now(), { cache: 'no-store' })).json();
      ls.set('shared', { ts: Date.now(), data });
      if (typeof render === 'function' && checks.length) render();
    } catch {}
  })();
  const rw = reworkState();
  const state = { rsOpen: false, okOpen: false, send: '', hl: false };
  const sel = new Set();      // выбранные причины (текстом)
  const seen = new Set();     // авто-причины, которые уже предлагались
  let checks = [];

  function showSend(label) {
    state.send = label;
    const b = qs('#brc-send');
    if (b) { b.style.display = 'block'; b.textContent = label; }
  }

  /* ---------- 6. подсветка в тексте ---------- */
  let hlOrig = null;
  const reEsc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const HL_RULES = () => [
    ['copy', copyPhrases.length ? new RegExp(copyPhrases.map((p) => p.split(' ').map(reEsc).join('[\\s,;:—–-]+')).join('|'), 'gi') : null, 'Фраза, по которой искали копипаст'],
    ['mix', new RegExp(RX_MIXED.source, 'g'), 'Латиница внутри русского слова'],
    ['caps', /(?<![А-Яа-яЁёA-Za-z])[А-ЯЁ]{4,}(?![А-Яа-яЁёA-Za-z])/g, 'Капс'],
    ['low', /[.!?]\s+[а-яё]/g, 'Предложение с маленькой буквы'],
    ['sp', /[а-яё][,.!?](?=[а-яё])/gi, 'Нет пробела после знака'],
    ['sup', new RegExp(RX_SUPER.source, 'gi'), 'Сверхъестественное'],
    ['ooc', new RegExp(RX_OOC.source, 'gi'), 'OOC-информация'],
  ].filter((r) => r[1]);

  function toggleHL() {
    if (!post) return 0;
    if (hlOrig !== null) { post.innerHTML = hlOrig; hlOrig = null; state.hl = false; return 0; }
    hlOrig = post.innerHTML;
    state.hl = true;
    let count = 0;
    for (const [cls, re, tip] of HL_RULES()) {
      const nodes = [];
      const w = document.createTreeWalker(post, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement.closest('mark.brc-m') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      while (w.nextNode()) nodes.push(w.currentNode);
      for (const n of nodes) {
        const str = n.textContent;
        re.lastIndex = 0;
        let m, last = 0, hit = false;
        const frag = document.createDocumentFragment();
        while ((m = re.exec(str))) {
          if (!m[0]) { re.lastIndex++; continue; }
          hit = true;
          frag.append(str.slice(last, m.index));
          const mk = document.createElement('mark');
          mk.className = 'brc-m ' + cls;
          mk.title = tip;
          mk.textContent = m[0];
          frag.append(mk);
          last = m.index + m[0].length;
          count++;
        }
        if (hit) { frag.append(str.slice(last)); n.replaceWith(frag); }
      }
    }
    return count;
  }

  /* ---------- отрисовка ---------- */
  function render() {
    const draft = qs('#brc-newr', box)?.value || '';
    const done = checks.filter((c) => c.s !== 'load');
    const loading = checks.filter((c) => c.s === 'load');
    const ok = done.filter((c) => c.s === 'ok');
    const warns = done.filter((c) => c.s === 'warn');
    const fails = done.filter((c) => c.s === 'fail');
    const autoR = [...fails, ...warns].filter((c) => c.r).map((c) => c.r);
    autoR.forEach((t) => { if (!seen.has(t)) { seen.add(t); sel.add(t); } });
    const autoSet = new Set(autoR);
    const listed = new Set([...manual, ...getShared(), ...getCust()]);
    const extraWarn = [...new Set(warns.filter((w) => w.r && !listed.has(w.r)).map((w) => w.r))];

    const pct = Math.round((ok.length / (done.length || 1)) * 100);
    const col = fails.length ? 'var(--r)' : warns.length ? 'var(--y)' : 'var(--g)';
    const verdict = fails.length ? `Найдено нарушений: ${fails.length}` : warns.length ? 'Проверь пару моментов' : loading.length ? 'Пока чисто…' : 'Можно одобрять';
    const RR = 26, C = 2 * Math.PI * RR;

    const statusTxt = (qs('.p-title-value .label')?.textContent || '') + ' ' + (qs('.p-breadcrumbs')?.textContent || '');
    const doneSt = /отказ/i.test(statusTxt) ? 'Отказано' : /одобрен/i.test(statusTxt) ? 'Одобрено' : '';
    const posted = doneSt ? null : qs('time.u-dt', firstMsg)?.getAttribute('data-time');
    const hours = posted ? Math.floor((Date.now() / 1000 - +posted) / 3600) : null;
    const timer = doneSt ? `<span class="chip ${doneSt === 'Одобрено' ? 'g' : 'r'}">${I('folder')}${doneSt}</span>` : hours == null ? '' : hours >= 72
      ? `<span class="chip late">${I('clock')}просрочено · ${hours} ч</span>`
      : `<span class="chip t">${I('clock')}${72 - hours} ч</span>`;

    const icon = (st) => (st === 'load' ? '<i class="sp"></i>' : I({ ok: 'check', warn: 'alert', fail: 'x' }[st]));
    const item = (c) => `<div class="it ${c.s}"><div class="ic">${icon(c.s)}</div><div class="tx">${esc2(c.t)}</div>${
      c.link ? `<a class="lnk" href="${esc2(c.link)}" target="_blank" title="Открыть">${I('ext')}</a>` : ''}</div>`;
    const ck = (txt, del) => `<label class="ck"><input type="checkbox" data-t="${esc2(txt)}" ${sel.has(txt) ? 'checked' : ''}><i></i><span>${esc2(txt)}${autoSet.has(txt) ? ' <em class="au">авто</em>' : ''}</span>${
      del != null ? `<button class="del" data-del="${del}" title="Удалить">×</button>` : ''}</label>`;

    let banner = '';
    if (rw && !rw.fixed && rw.left <= 0) banner = `<div class="bn r"><div>${I('clock')}<span><b>24 ч на доработку вышли</b> — автор ничего не исправил</span></div>
      <button class="a no rec" id="brc-rwno">${I('ban')}Отказать: не исправлено</button></div>`;
    else if (rw && !rw.fixed) banner = `<div class="bn y"><div>${I('wrench')}<span>На доработке — у автора осталось <b>${rw.left} ч</b></span></div></div>`;
    else if (rw && rw.fixed) banner = `<div class="bn t"><div>${I('edit')}<span>Автор ${rw.edited ? 'отредактировал тему' : 'ответил'} после доработки — перепроверь</span></div></div>`;

    const q = copyPhrases[0] ? encodeURIComponent(`"${copyPhrases[0]}"`) : '';
    const cust = getCust();
    const recOk = !fails.length && !loading.length && !doneSt;
    const recNo = fails.length && !doneSt;
    box.style.setProperty('--accent', fails.length ? '#ff5c6c' : warns.length ? '#ffb547' : '#22c58b');

    box.innerHTML = `<div class="in">
      <div class="hd">
        <div class="ring">
          <svg width="58" height="58"><circle cx="29" cy="29" r="${RR}" stroke="#ffffff10" stroke-width="5" fill="none"/>
            <circle cx="29" cy="29" r="${RR}" stroke="${col}" stroke-width="5" fill="none" stroke-linecap="round"
              stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}" style="transition:stroke-dashoffset .8s"/></svg>
          <b style="color:${col}">${pct}%</b>
        </div>
        <div style="min-width:0">
          <div class="ttl">${sec.name} · автопроверка</div>
          <div class="vrd" style="color:${col}">${verdict}</div>
          <div class="chips">
            <span class="chip g">${I('check')}${ok.length}</span><span class="chip y">${I('alert')}${warns.length}</span><span class="chip r">${I('x')}${fails.length}</span>${timer}
          </div>
        </div>
        <button class="tog" title="Свернуть">${I('down')}</button>
      </div>

      <div class="body">
        ${banner}
        <div class="acts">
          <button class="a ok ${recOk ? 'rec' : ''}" id="brc-ok" ${fails.length ? 'disabled title="Есть нарушения"' : ''}>${I('check')}Одобрить</button>
          <button class="a no ${recNo ? 'rec' : ''} ${state.rsOpen ? 'on' : ''}" id="brc-no">${I('ban')}Отказ${sel.size ? ` <b class="nb">${sel.size}</b>` : ''}</button>
          <button class="a wt" id="brc-wt">${I('hour')}Рассмотр.</button>
        </div>

        <div class="rs ${state.rsOpen ? 'open' : ''}" id="brc-rs">
          ${fails.length ? '<div class="sub">НАЙДЕНО СКРИПТОМ</div>' + fails.map((f) => ck(f.r)).join('') : ''}
          ${extraWarn.length ? '<div class="sub">СКРИПТ ПОДОЗРЕВАЕТ — СНИМИ, ЕСЛИ ЛОЖНО</div>' + extraWarn.map((t) => ck(t)).join('') : ''}
          <div class="sub">ОТМЕТЬ САМ, ЕСЛИ ЕСТЬ</div>
          ${manual.map((m) => ck(m)).join('')}
          ${getShared().length ? '<div class="sub">ОБЩИЕ ПРИЧИНЫ КОМАНДЫ</div>' + getShared().map((m) => ck(m)).join('') : ''}
          ${cust.length ? '<div class="sub">ТВОИ ПРИЧИНЫ</div>' + cust.map((c, i) => ck(c, i)).join('') : ''}
          <div class="addr"><input id="brc-newr" placeholder="Своя причина…"><button id="brc-addr" title="Добавить">${I('plus')}</button></div>
          <div class="rsb">
            <button class="a no rec" id="brc-decline">${I('ban')}Отказать</button>
            <button class="a wt" id="brc-rework">${I('wrench')}Доработка 24 ч</button>
          </div>
        </div>

        <div class="tools">
          <button class="tb ${state.hl ? 'on' : ''}" id="brc-hl">${I('search')}${state.hl ? 'Убрать' : 'Подсветка'}</button>
          <button class="tb" id="brc-next">${I('next')}Следующая</button>
          <button class="tb" id="brc-rul">${I('book')}Правила</button>
          ${q ? `<a class="tb" href="https://www.google.com/search?q=${q}" target="_blank">${I('globe')}Google</a>
                 <a class="tb" href="https://yandex.ru/search/?text=${q}" target="_blank">${I('globe')}Яндекс</a>` : ''}
        </div>
        ${state.hl ? `<div class="legend"><mark class="brc-m copy">копипаст-фраза</mark><mark class="brc-m mix">подмена букв</mark><mark class="brc-m caps">капс</mark><mark class="brc-m low">маленькая буква</mark><mark class="brc-m sp">нет пробела</mark><mark class="brc-m sup">сверхъестеств.</mark><mark class="brc-m ooc">OOC</mark></div>` : ''}

        ${fails.length || warns.length || loading.length ? `<div class="sec"><div class="sh">Замечания</div><div class="lst">${[...fails, ...warns, ...loading].map(item).join('')}</div></div>` : ''}
        <div class="sec">
          <div class="sh" id="brc-okh"><span>Пройдено · ${ok.length}</span><span class="cnt">${state.okOpen ? 'скрыть' : 'показать'}</span></div>
          <div class="okl ${state.okOpen ? 'open' : ''}"><div class="lst">${ok.map(item).join('')}</div></div>
        </div>

        <button class="send" id="brc-send" style="display:${state.send ? 'block' : 'none'}">${state.send}</button>
        <div class="ft">Скрипт кураторов · v${VERSION}</div>
      </div>
    </div>`;

    if (ls.get('min', false)) box.classList.add('min');
    if (draft) qs('#brc-newr', box).value = draft;
    bind(fails, extraWarn);
  }

  function bind(fails, extraWarn = []) {
    const $ = (id) => qs('#' + id, box);
    const reasons = () => {
      const order = [...fails.map((f) => f.r), ...extraWarn, ...manual, ...getShared(), ...getCust()];
      return order.filter((t, i) => sel.has(t) && order.indexOf(t) === i);
    };
    const mark = (id) => box.querySelectorAll('.acts .a').forEach((b) => b.classList.toggle('on', b.id === id));

    qs('.tog', box).onclick = () => { box.classList.toggle('min'); ls.set('min', box.classList.contains('min')); };
    $('brc-okh').onclick = () => { state.okOpen = !state.okOpen; render(); };
    $('brc-send').onclick = finish;

    box.querySelectorAll('.ck input').forEach((inp) => {
      inp.onchange = () => { inp.checked ? sel.add(inp.dataset.t) : sel.delete(inp.dataset.t); const nb = qs('#brc-no .nb', box); if (nb) nb.textContent = sel.size; };
    });
    box.querySelectorAll('.del').forEach((b) => {
      b.onclick = (e) => {
        e.preventDefault();
        const c = getCust(); const [gone] = c.splice(+b.dataset.del, 1);
        sel.delete(gone); ls.set(custKey, c); render();
      };
    });
    const add = () => {
      const v = $('brc-newr').value.trim();
      if (!v) return;
      const c = getCust(); if (!c.includes(v)) c.push(v);
      ls.set(custKey, c); sel.add(v); render(); toast('Причина сохранена');
    };
    $('brc-addr').onclick = add;
    $('brc-newr').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };

    $('brc-next').onclick = goNext;
    $('brc-rul').onclick = () => openRules(sec.id);
    $('brc-hl').onclick = () => {
      const n = toggleHL();
      render();
      if (state.hl) { toast(n ? `Подсвечено мест: ${n}` : 'Подозрительных мест не нашёл'); post?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    };

    $('brc-no').onclick = () => { state.rsOpen = !state.rsOpen; render(); };
    $('brc-ok').onclick = () => {
      mark('brc-ok');
      choose(T.accept(), sec.key === 'org'
        ? { prefix: PREFIX.ACCEPT, close: false, sticky: true } // орга: открыта + закреп (п. 1.2, 2.4)
        : { prefix: PREFIX.ACCEPT, close: true, move: 'acc' });
    };
    $('brc-wt').onclick = () => { mark('brc-wt'); choose(T.watch(), { prefix: PREFIX.WATCHED, close: false }); };
    $('brc-decline').onclick = () => {
      const rs = reasons();
      if (!rs.length) return toast('Отметь хотя бы одну причину');
      choose(T.decline(rs), { prefix: PREFIX.DECLINE, close: true, move: 'dec' });
    };
    $('brc-rework').onclick = () => {
      const rs = reasons();
      if (!rs.length) return toast('Отметь, что нужно исправить');
      choose(T.rework(rs), { prefix: PREFIX.WATCHED, close: false, move: 'rw' });
    };
    const rwno = $('brc-rwno');
    if (rwno) rwno.onclick = () => choose(T.decline([`Тема не была исправлена в течение 24 часов после отправки на доработку (п. ${RULE.rw}).`]), { prefix: PREFIX.DECLINE, close: true, move: 'dec' });
  }

  /* ---------- запуск ---------- */
  (async () => {
    if (orgApproved) return orgControl();
    checks = await runChecks();
    const LOAD_DUP = { s: 'load', t: 'Ищу другие темы автора…' };
    const LOAD_COPY = { s: 'load', t: 'Ищу копипаст по форуму…' };
    if (sec.key !== 'sit') checks.push(LOAD_DUP);
    checks.push(LOAD_COPY);
    render();

    const cacheKey = 'c_' + threadId;
    const cache = ls.get(cacheKey, null);
    const fresh = cache && Date.now() - cache.ts < 30 * 60e3 && cache.len === text.length && cache.v === VERSION;
    const swap = (from, to) => { const i = checks.indexOf(from); if (i >= 0) { if (to) checks[i] = to; else checks.splice(i, 1); } render(); };
    const safe = async (fn) => {
      try { return await fn(); }
      catch (e) { return { s: 'warn', t: e.message === 'flood' ? 'Форум просит подождать с поиском — обнови страницу через минуту' : 'Поиск не сработал: ' + e.message }; }
    };

    let dup, copy;
    if (fresh) { dup = cache.dup; copy = cache.copy; }
    else {
      if (sec.key !== 'sit') { dup = await safe(dupCheck); swap(LOAD_DUP, dup); await sleep(2500); }
      copy = await safe(copyCheck);
      const okToCache = (x) => !x || !/подождать|не сработал/.test(x.t);
      if (okToCache(dup) && okToCache(copy)) ls.set(cacheKey, { ts: Date.now(), len: text.length, dup, copy, v: VERSION });
    }
    if (sec.key !== 'sit') swap(LOAD_DUP, dup);
    swap(LOAD_COPY, copy);
  })();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brcMain, { once: true });
  else brcMain();
})();
