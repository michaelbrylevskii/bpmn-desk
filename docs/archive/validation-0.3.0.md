# Проверка версии 0.3.0

Дата: 2026-10-09. Версия: 0.3.0. Локальная среда: Linux x86_64, Node.js 26.7.0, Electron 44.7.0, Temurin JDK 21.0.11; Java-код компилируется с `release=17`. Отчёт охватывает Flowable, Camunda 7 и доработки интерфейса. Предыдущие результаты сохранены в [отчёте 0.2.0](validation-0.2.0.md).

## Основной набор

- `npm run check`: strict TypeScript, ESLint, **63 unit-теста** в 18 файлах. Семь встроенных схем проходят двойной XML roundtrip. Дополнительно проверяются неизвестные теги самого Camunda URI, альтернативные префиксы/их локальное переопределение, независимый retry, вложенные команды и сохранность исходного дерева, профили пустых схем, применимость форм, Camunda diagnostics и глубокое копирование с областями ID.
- `npm run test:e2e`: **58 passed, 1 skipped**. Chromium — 48 сценариев, Electron — 9, AppImage — 1. Сохраняется основной набор Flowable, языков, темы, XML, recovery, локальных файлов и защиты данных.
- Новые UI-сценарии: создание профилей и recovery Camunda; external tasks, явное false, listeners/fields, formData/enum/validation, map/list/script, альтернативный `c7`, смешанная схема, connector, multi-instance, error/message definitions. Проверены смена типа задачи и copy/paste обоих движков с undo и сохранением неизвестных данных.
- Native Electron открывает Camunda через CLI и сохраняет изменение вложенного loop target в локальный файл. Готовая AppImage открывает встроенные Flowable и Camunda, переключает EN/RU и показывает их свойства; sandbox включён.
- `npm run package:linux`: AppImage собрана штатной командой. Новых runtime-зависимостей JavaScript не добавлено.
- Состав пакета: семь примеров и provenance побайтово совпадают с исходниками; старых имён нет. ASAR не содержит локальные кеши, пользовательские пакеты, тесты или Java-инструменты.
- `npm run validate:flowable`: официальный converter 7.2 подтвердил пять встроенных экспортов и отдельный boundary layout export.
- `npm run validate:camunda`: официальная BPMN Model API 7.24.0 прочитала и валидировала два встроенных экспорта, изменённую integration и copy/paste. Исходные и изменённые модели сравниваются без DI; текстовые значения сохраняются. Ожидаемый XML integration строится из оригинала отдельно от bpmn-js. Проверка отвергает контрольный XML с повторным глобальным Camunda ID.
- `/tmp/actionlint .github/workflows/build.yml`: конфигурация CI прошла проверку. Обе платформы запускают Flowable/Camunda validators; Maven cache учитывает оба инструмента.
- Доработки после ручного просмотра: явный выбор профиля при создании и отмена Escape, engine prefixes всех примеров, удалённый Offline badge, toggle поиска с сохранением запроса, точное восстановление DI после undo/redo, PNG 2× с белым/прозрачным фоном. PNG проверен по signature, размерам и пикселям; native IPC отклоняет некорректный payload и не добавляет экспорт в recent files. Сохранённые XML и dirty state при экспорте не меняются.
- XML расширений выровнен относительно собственного корня: проверены применение/undo и сохранность текста, CDATA, mixed content, неразрывных пробелов и унаследованного xml:space. Фокус холста имеет акцент приложения в обеих темах. Тема auto реагирует на смену media query без потери XML draft/search/undo; старые light/dark сохранены. В Electron переключение nativeTheme проверено без принудительной эмуляции light со стороны Playwright; ручной выбор переживает перезапуск. Скриншоты EN/RU обновлены в обеих темах.
- Уведомления имеют явные error/success/info и соответствующие alert/status. Проверены malformed XML и недопустимый BPMN body text: отказ сохраняет черновик, модель и undo; подробности парсера доступны отдельно, EN/RU переключаются. XML расширений показывает ту же ошибку в обеих темах. Управляемые часы проверяют затухание и самозакрытие, наведение в конце срока, debounce 1,5 секунды, повторное наведение, фокус, раскрытые подробности и новый срок при повторной ошибке. Ошибка внешнего изменения файла в native Electron также имеет роль alert.
- `git diff --check`: ошибок форматирования нет.

## Дополнительный локальный набор

Пять пользовательских схем из внешнего пакета прошли double roundtrip, пять UI-открытий/сохранений и официальный Flowable converter. Receipt проверяет контрольные суммы входов и экспортов. Исходные схемы/provenance не изменены и не входят в Git, дистрибутив или основной набор.

## Нативный GitHub Actions

[Прогон 37988254301](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/37988254301) на merge-коммите `aeefcf7` завершён успешно:

| Среда | Unit | E2E | Сборки |
| --- | --- | --- | --- |
| Ubuntu 24.04, Node.js 24, JDK 17 | 63 passed | 58 passed, 1 Windows skip | AppImage |
| Windows Server 2022, Node.js 24, JDK 17 | 61 passed, 2 symlink skip | 58 passed, включая готовый EXE | NSIS installer и portable |

Обе платформы выполнили strict TypeScript, ESLint, проверки UI и Electron, Flowable converter и Camunda Model API. Windows содержит 48 Chromium-сценариев, 9 Electron и один запуск собранного приложения. Дистрибутивы сохранены в artifacts. При публикации тег запускает такую же матрицу заново; ссылка на релизный прогон добавляется в описание GitHub Release.

Повторный [прогон 37989030193](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/37989030193) выявил нестабильность firstWindow для packaged executable: на каждой ОС 57 UI/Electron-сценариев прошли, проверка готового приложения не обнаружила окно. Диагностика подтвердила загруженный DOM и существующий CDP target. Тестовый адаптер переведён на публичное подключение CDP после навигации; 20 последовательных локальных запусков AppImage прошли. Подробности: [ADR 0019](../adr/0019-packaged-test-connection.md).

После исправления [прогон основной ветки 37991882513](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/37991882513) и [релизный прогон 37992511168](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/37992511168) успешно выполнили полную матрицу обеих ОС, включая AppImage и готовый Windows EXE. Проверенный коммит: `41d144a`; тег: `v0.3.0`.

[Релиз 0.3.0](https://github.com/michaelbrylevskii/bpmn-desk/releases/tag/v0.3.0) опубликован с AppImage, NSIS installer, portable и SHA256SUMS. Состав проверен по GitHub API: ровно три дистрибутива и manifest; суммы всех дистрибутивов и самого manifest совпали с asset.digest, тег указывает на проверенный коммит, версия отмечена latest. Локальная сборка в релиз не загружалась.

## Границы

Локальный прогон выполнен на Linux; Windows-сценарий пропущен по платформе. Новая версия отдельно проверена нативно на Windows Server 2022 в CI. Эти тесты не запускают installer/portable launcher и не подтверждают ручную установку или ассоциации. Пользовательское подтверждение Windows-инсталлятора относится к 0.2.0. macOS не проверялась. В локальной среде нет FUSE: тест запускает извлечённое содержимое AppImage.

Model API подтверждает XML/модель и сохранность данных, но не выполняет deployment, delegates, scripts, connectors или процесс. Примеры используют условные прикладные ресурсы. Camunda 8, DMN/CMMN и внешние дизайнеры форм не включены. Подробности: [camunda7.md](../camunda7.md), [ADR 0014](../adr/0014-engine-profiles.md).

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

Для независимых Java-проверок нужны JDK 17+ и Maven. Внешние наборы подключаются отдельно, по [инструкции](../local-schema-packs.md).
