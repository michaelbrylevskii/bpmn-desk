# Проверка поддержки Camunda 7

Дата: 2026-10-09. Ветка: `feat/camunda-7`. Среда: Linux x86_64, Node.js 26.7.0, Electron 44.7.0, Temurin JDK 21.0.11; Java-код компилируется с `release=17`. Теги, релизы и push в рамках этой задачи не выполнялись. Версия пакета остаётся 0.2.0; локальная AppImage содержит изменения ветки, опубликованная 0.2.0 — прежнюю функциональность.

## Основной набор

- `npm run check`: strict TypeScript, ESLint, **61 unit-тест** в 17 файлах. Семь встроенных схем проходят двойной XML roundtrip. Дополнительно проверяются неизвестные теги самого Camunda URI, альтернативные префиксы/их локальное переопределение, независимый retry, вложенные команды и сохранность исходного дерева, профили пустых схем, применимость форм, Camunda diagnostics и глубокое копирование с областями ID.
- `npm run test:e2e`: **52 passed, 1 skipped**. Chromium — 42 сценария, Electron — 9, AppImage — 1. Сохраняется основной набор Flowable, языков, темы, XML, recovery, локальных файлов и защиты данных.
- Новые UI-сценарии: создание профилей и recovery Camunda; external tasks, явное false, listeners/fields, formData/enum/validation, map/list/script, альтернативный `c7`, смешанная схема, connector, multi-instance, error/message definitions. Проверены смена типа задачи и copy/paste обоих движков с undo и сохранением неизвестных данных.
- Native Electron открывает Camunda через CLI и сохраняет изменение вложенного loop target в локальный файл. Готовая AppImage открывает встроенные Flowable и Camunda, переключает EN/RU и показывает их свойства; sandbox включён.
- `npm run package:linux`: AppImage собрана штатной командой. Новых runtime-зависимостей JavaScript не добавлено.
- Состав пакета: семь примеров и provenance побайтово совпадают с исходниками; старых имён нет. ASAR не содержит локальные кеши, пользовательские пакеты, тесты или Java-инструменты.
- `npm run validate:flowable`: официальный converter 7.2 подтвердил пять встроенных экспортов и отдельный boundary layout export.
- `npm run validate:camunda`: официальная BPMN Model API 7.24.0 прочитала и валидировала два встроенных экспорта, изменённую integration и copy/paste. Исходные и изменённые модели сравниваются без DI; текстовые значения сохраняются. Ожидаемый XML integration строится из оригинала отдельно от bpmn-js. Проверка отвергает контрольный XML с повторным глобальным Camunda ID.
- `/tmp/actionlint .github/workflows/build.yml`: конфигурация CI прошла проверку. Для Linux/Windows добавлен запуск Camunda validator и Maven cache обоих инструментов; удалённый workflow этой ветки не запускался.
- Доработки после ручного просмотра: явный выбор профиля при создании и отмена Escape, engine prefixes всех примеров, удалённый Offline badge, toggle поиска с сохранением запроса, точное восстановление DI после undo/redo, PNG 2× с белым/прозрачным фоном. PNG проверен по signature, размерам и пикселям; native IPC отклоняет некорректный payload и не добавляет экспорт в recent files. Сохранённые XML и dirty state при экспорте не меняются.
- XML расширений выровнен относительно собственного корня: проверены применение/undo и сохранность текста, CDATA, mixed content, неразрывных пробелов и унаследованного xml:space. Фокус холста имеет акцент приложения в обеих темах. Тема auto реагирует на смену media query без потери XML draft/search/undo; старые light/dark сохранены. В Electron переключение nativeTheme проверено без принудительной эмуляции light со стороны Playwright; ручной выбор переживает перезапуск. Скриншоты EN/RU обновлены в обеих темах.
- `git diff --check`: ошибок форматирования нет.

## Дополнительный локальный набор

Пять пользовательских схем из внешнего пакета прошли double roundtrip, пять UI-открытий/сохранений и официальный Flowable converter. Receipt проверяет контрольные суммы входов и экспортов. Исходные схемы/provenance не изменены и не входят в Git, дистрибутив или основной набор.

## Границы

Новые изменения проверены на Linux. Windows-сценарий пропущен по платформе; прежние результаты Windows CI версии 0.2.0 не подтверждают эту ветку. macOS не проверялась. В среде нет FUSE: тест запускает извлечённое содержимое AppImage.

Model API подтверждает XML/модель и сохранность данных, но не выполняет deployment, delegates, scripts, connectors или процесс. Примеры используют условные прикладные ресурсы. Camunda 8, DMN/CMMN и внешние дизайнеры форм не включены. Подробности: [camunda7.md](camunda7.md), [ADR 0014](adr/0014-engine-profiles.md).

## Воспроизведение

```bash
npm ci
npm run setup:electron
npm run setup:e2e
npm run check
npm run package:linux
npm run test:e2e
npm run validate:flowable
npm run validate:camunda
```

Для независимых Java-проверок нужны JDK 17+ и Maven. Внешние наборы подключаются отдельно, по [инструкции](local-schema-packs.md).
