# Разработка

Electron, React, TypeScript, bpmn-js и CodeMirror. Рекомендуется Node.js 24; допустимый диапазон — в `package.json`. JDK 17+ и Maven нужны только для тестового Flowable и проверки экспортов.

## Запуск

```bash
npm ci
npm run setup:electron
npm run setup:e2e
npm run dev
```

`npm run dev:web` — браузерный preview на `http://127.0.0.1:5173`; desktop-файлы, недавние документы и подключения к движкам в нём недоступны.

## Команды

| Команда | Назначение |
| --- | --- |
| `npm run check` | strict TypeScript, ESLint, unit и XML roundtrip |
| `npm run package:linux` | AppImage в `release/` |
| `npm run package:windows` | Windows x64: NSIS и portable; Windows или Linux с Wine |
| `npm run package:windows:docker` | Кросс-сборка через закреплённый Docker-образ с Wine |
| `npm run test:e2e` | Chromium, Electron, CLI, файлы и готовое приложение |
| `npm run test:runtime` | Независимый Flowable 7.2/H2 и Electron; сервер завершается после тестов |
| `npm run validate:flowable` | Официальный converter 7.2 проверяет экспорты UI |
| `npm run validate:camunda` | BPMN Model API 7.24 проверяет экспорты, изменения и copy/paste |
| `npm run capture:screenshots` | Обложка двух тем, редактор, стартовая страница и Camunda |

Перед сдачей выполняются `check`, `package:linux` и `test:e2e`; для изменений монитора — `test:runtime`. Java-валидаторы запускаются после E2E: они читают его экспорты. Готовое приложение проверяется на своей ОС; отсутствующая платформа явно пропускается.

CI выполняет нативную матрицу Linux/Windows и проверки моделей. Пользовательские пакеты в неё не входят. [Актуальные результаты](validation.md).

## Материалы README

Скриншоты показывают настоящие страницы приложения без изменения его кода. Обложка снимается с двух живых копий одной схемы: слева светлая тема, справа тёмная. Дополнительные изображения размещаются HTML-таблицей с относительными ссылками на полные PNG.

Скриншот монитора: `npm run test:runtime`, затем копирование `test-results/runtime-dead-letter.png` в `docs/images/monitor.png`. Источник — оригинальная MIT-схема [failure](../tools/runtime-fixture/src/main/resources/processes/failure.bpmn20.xml); [provenance](../tools/runtime-fixture/src/main/resources/processes/provenance.json). Остальные изображения используют [встроенные примеры](../examples/provenance.json).

README — английский основной и [русский](../README.ru.md) с одинаковыми возможностями, изображениями и ссылками. Проектная документация — на русском; GitHub release notes — английский текст и русский перевод в `<details>`.
