# Проверка релиза 0.4.0

Проверенный коммит: `9a59f14524fc16b958954836d1430317099e3ad5`, тег `v0.4.0`.

[Релиз](https://github.com/michaelbrylevskii/bpmn-desk/releases/tag/v0.4.0) · [Нативная матрица](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/38060956883)

| Среда | Unit | E2E | Flowable runtime |
| --- | --- | --- | --- |
| Ubuntu 24.04 | 84 passed | 65 passed, включая AppImage | 13 passed |
| Windows Server 2022 | 82 passed, 2 symlink skip | 65 passed, включая готовый EXE | 13 passed |

Обе ОС прошли strict TypeScript, ESLint, нативную сборку и официальные Flowable converter 7.2 / Camunda Model API 7.24. Java-проверки включают экспорты, изменения модели, copy/paste и отрицательный контроль.

## Покрытие

- Roundtrip, неизвестные расширения, namespace-префиксы, формы обоих движков, моделирование, undo/redo и dirty state.
- XML, ошибки импорта, локализация, темы, уведомления, native файлы/CLI/recent, recovery и независимые вкладки.
- Точная версия runtime-схемы, переменные, настоящие dead-letter, stacktrace, связи экземпляров, фильтры и авторизация.
- Ограниченная сводка: таймаут, частичный/недоступный результат, поздний ответ и отсутствие N+1.
- Экспорт и viewport, длинные идентификаторы, настройки подключений и сохранение через symlink/junction.

## Артефакты

AppImage, installer, portable и `SHA256SUMS` собраны GitHub Actions, скачаны и проверены по manifest и asset.digest. ASAR соответствует `out`; примеры, provenance и лицензии совпадают с исходниками. Java, тесты, кеши и пользовательские данные исключены из поставки.

`npm audit --omit=dev`: 0 предупреждений. Полный аудит на дату выпуска: 8 moderate по одной [уязвимости sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) в dev-цепочке electron-builder. Эти пакеты отсутствуют в ASAR; исправленной версии sprintf-js в advisory нет.

## Границы подтверждения

Windows проверена автоматическим запуском приложения, без ручной приёмки installer/portable launcher и ассоциаций. macOS не проверялась. Локальная AppImage проверяется с распаковкой без FUSE.

Flowable/H2 — независимый стенд с условными данными. Пользовательские серверы, корпоративная авторизация и разблокировка keyring конкретной ОС не подтверждены. Model API не выполняет deployment, delegates или scripts.

[Воспроизведение](../development.md) · [Исторические протоколы](README.md)
