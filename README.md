<div align="center">

# 🌸 KOCH BRAUZER

**Минималистичная и красивая страница новой вкладки**
для Firefox, Edge, Chrome и других браузеров

<br>

![Manifest V3](https://img.shields.io/badge/Manifest-V3-ff4fa3?style=for-the-badge)
![Firefox](https://img.shields.io/badge/Firefox-142%2B-ff8ac2?style=for-the-badge&logo=firefoxbrowser&logoColor=white)
![Edge](https://img.shields.io/badge/Edge-supported-0078D7?style=for-the-badge&logo=microsoftedge&logoColor=white)
![Chromium](https://img.shields.io/badge/Chromium-supported-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Privacy](https://img.shields.io/badge/Data%20collection-none-34d399?style=for-the-badge)
![MIT License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)

<br>

[**🦊 Firefox**](https://addons.mozilla.org/ru/firefox/addon/koch-brauzer/) &nbsp;•&nbsp;
[**🌐 Edge**](https://microsoftedge.microsoft.com/addons/detail/koch-brauzer/kmkmnnjonlnhcpdcjfgfhhjepcbakefm) &nbsp;•&nbsp;
[**🛡 VirusTotal**](https://www.virustotal.com/gui/file/7b4ff34d860c79ada808f309395d926cd4b92ae5c0a254cb64c146f89289fac9?nocache=1)

</div>

---

## 📸 Скриншоты

<table>
  <tr>
    <td colspan="2">
      <img src="Docs/screenshot.png" width="100%" alt="Главная страница">
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="Docs/settings.png" width="100%" alt="Настройки">
    </td>
    <td width="50%">
      <img src="Docs/settings-pt2.png" width="100%" alt="Настройки, часть 2">
    </td>
  </tr>
</table>

## 🚀 Установка

| Браузер | Как установить |
|---|---|
| 🦊 **Firefox** | [Firefox Add-ons](https://addons.mozilla.org/ru/firefox/addon/koch-brauzer/) |
| 🌐 **Edge** | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/koch-brauzer/kmkmnnjonlnhcpdcjfgfhhjepcbakefm) |
| 🧩 **Chrome / Opera / Brave** | вручную, см. ниже |

<details>
<summary><b>Ручная установка из исходников</b></summary>

<br>

**Chrome, Edge, Opera, Brave**

1. Скачай репозиторий (**Code → Download ZIP**) и распакуй.
2. Открой `chrome://extensions` (в Edge: `edge://extensions`).
3. Включи **режим разработчика**.
4. Нажми **Загрузить распакованное** и выбери папку `KOCH-BRAUZER-CHROMIUM`.

**Firefox**

1. Открой `about:debugging#/runtime/this-firefox`.
2. Нажми **Загрузить временное дополнение**.
3. Выбери файл `KOCH-BRAUZER/manifest.json`.

</details>

## ✨ Возможности

| | |
|---|---|
| 🕐 **Погода** | любые города, учёт часовых поясов, эмодзи-погода (open-meteo) |
| 🔎 **Умный поиск** | 5 движков (Google, DDG, Bing, Яндекс, Brave), история с подсказками, автоопределение URL |
| 🗂 **Категории и ярлыки** | создание, редактирование, drag & drop категорий и плиток, favicon / эмодзи / своя иконка |
| 🎨 **8 тем** | Rose, Purple, Ocean, Green, Dark, Light, Midnight, Sunset |
| 🧩 **Кастомизация** | прозрачность панелей, карточек и фона, скругления 5 элементов, семейство, размер, толщина и межстрочный интервал шрифта, скорость анимаций |
| 🖼 **Фон** | неоновые орбы (по умолчанию), видео или изображение, прозрачность и размытие |
| 👤 **Аватар** | своё изображение (автосжатие до 256px) или неоновая заглушка |
| 💾 **Бэкапы** | экспорт и импорт всех настроек одним JSON-файлом |

## 🎨 Темы

![Rose](https://img.shields.io/badge/Rose-ff4fa3?style=flat-square)
![Purple](https://img.shields.io/badge/Purple-a855f7?style=flat-square)
![Ocean](https://img.shields.io/badge/Ocean-0ea5e9?style=flat-square)
![Green](https://img.shields.io/badge/Green-22c55e?style=flat-square)
![Dark](https://img.shields.io/badge/Dark-1f2937?style=flat-square)
![Light](https://img.shields.io/badge/Light-e5e7eb?style=flat-square&labelColor=e5e7eb&color=e5e7eb)
![Midnight](https://img.shields.io/badge/Midnight-1e1b4b?style=flat-square)
![Sunset](https://img.shields.io/badge/Sunset-f97316?style=flat-square)

Переключаются в один клик в шапке. Выбор сохраняется и переживает перезапуск браузера.

## ⚡ Почему это быстро

- **Один модуль** `scripts/app.js`: никаких гонок между скриптами и лишних запросов.
- **Одно чтение хранилища на запуск** и кэш настроек в памяти.
- **Часы рисуются мгновенно**, геокодинг и погода догружаются в фоне.
- **Медиафайлы лежат в IndexedDB** (блобы), а не в base64 внутри настроек: хранилище не раздувается, настройки сохраняются быстро.
- **Debounced-обработчики** и никаких лишних observers и interval'ов.

## 🗂 Структура проекта

```text
koch-brauzer/
├── Docs/                  # скриншоты для README
├── KOCH-BRAUZER/
│   ├── manifest.json      # Manifest V3 (service_worker + scripts для всех браузеров)
│   ├── background.js      # фоновый скрипт: стартовая вкладка, onInstalled
│   ├── newtab.html        # разметка и все стили (inline <style>, CSS-переменные)
│   └── scripts/
│       └── app.js         # вся логика одним ES-модулем
└── build.py               # сборка zip-пакетов для магазинов
```

## 📦 Сборка пакетов для магазинов

Магазины проверяют манифест строго: Edge и Chrome принимают в MV3 только `background.service_worker`, Firefox только `background.scripts`. Поэтому для публикации пакеты собираются отдельно:

```bash
python build.py
```

В папке `dist/` появятся:

- `koch-brauzer-chromium-<версия>.zip` для Edge, Chrome, Opera и Brave;
- `koch-brauzer-firefox-<версия>.zip` для addons.mozilla.org.

## 🏗 Архитектура

- **Настройки**: `browser.storage.local` с версионной схемой (`schemaVersion`) и миграцией. После обновления старые настройки не теряются, новые поля получают значения по умолчанию (deep-merge).
- **Медиа**: видео и картинки фона хранятся блобами в **IndexedDB**, в настройках остаётся только ссылка. Нет лимитов на размер файла и мегабайтных base64-строк в storage.
- **Синхронизация**: `storage.onChanged` мгновенно применяет изменения настроек во всех открытых вкладках.
- **Совместимость**: основной API `browser.*` (Firefox) с аккуратным фолбэком на `chrome.*` и `localStorage`, поэтому `newtab.html` можно открыть просто в браузере без установки.
- **Приватность**: `data_collection_permissions.required: ["none"]`. Расширение ничего не собирает, всё хранится только локально.

### 🔌 Сторонние сервисы

- [open-meteo.com](https://open-meteo.com): погода и геокодинг городов (без API-ключа и без логов);
- `google.com/s2/favicons`: иконки ярлыков.

## 🤝 Контрибьют

Баги и идеи присылай в [Issues](../../issues).

<div align="center">

---

Сделано с 💗 &nbsp;|&nbsp; KOCH BRAUZER

</div>
