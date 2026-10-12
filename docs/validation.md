# Проверка релиза 0.4.1

Проверенный коммит: `fba813b8ddf1634883aaa264d3dc0dec591720ce`, тег `v0.4.1`.

[Релиз](https://github.com/michaelbrylevskii/bpmn-desk/releases/tag/v0.4.1) · [Проверка main](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/38306594534) · [Релизная матрица](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/38307374299)

| Среда | Unit | E2E | Flowable runtime |
| --- | --- | --- | --- |
| Ubuntu 24.04 | 89 passed | 67 passed, включая AppImage | 15 passed |
| Windows Server 2022 | 87 passed, 2 symlink skip | 65 passed, включая готовый EXE | 15 passed |

Обе матрицы прошли strict TypeScript, ESLint, нативную сборку и официальные Flowable converter 7.2 / Camunda Model API 7.24.

## Покрытие

- Roundtrip, неизвестные расширения, формы обоих движков, моделирование, undo/redo, dirty state и экспорт.
- XML, локализация, темы, уведомления, файлы/CLI/recent, recovery и независимые вкладки.
- Точная версия runtime-схемы, переменные, dead-letter, stacktrace, связи экземпляров, фильтры и авторизация.
- Совместимость старых профилей, проверка и сохранение таймаута; бюджет чтения body и приоритет общего deadline сводки.
- Медленный API: отсутствие автоматических повторов, сохранение страницы после ошибки обновления, смена фильтров и игнорирование позднего ответа. Эти два сценария выполняются также в runtime-проекте на Windows.

## Артефакты

AppImage, installer, portable и `SHA256SUMS` собраны релизным GitHub Actions. Все четыре файла скачаны: размеры и SHA-256 совпадают с manifest и GitHub asset.digest. Тег указывает на проверенный коммит, релиз опубликован как latest.

Опубликованная AppImage распакована: версия, ASAR/скомпилированный код, примеры, provenance и лицензии совпадают с локальной сборкой проверенного исходника. Тесты, Java, кеши и пользовательские данные исключены из поставки. `npm audit --omit=dev`: 0 уязвимостей.

## Границы подтверждения

Windows проверена автоматическим запуском приложения, без ручной приёмки installer/portable launcher и ассоциаций. macOS не проверялась. AppImage проверяется с распаковкой без FUSE.

Flowable/H2 — независимый стенд с условными данными. Production SQL/count не оптимизирован; настройка таймаута позволяет дольше ждать ответа. Пользовательские серверы и корпоративная авторизация не входят в тесты. Model API не выполняет deployment, delegates или scripts.

[Воспроизведение](development.md) · [Исторические протоколы](archive/README.md)
