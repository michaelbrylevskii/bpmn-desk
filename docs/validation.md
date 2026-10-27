# Проверка релиза 0.5.0

Проверенный коммит: `0399be1d2a298cde1cb94b22c2027eab18db8a88`, тег `v0.5.0`.

[Релиз](https://github.com/michaelbrylevskii/bpmn-desk/releases/tag/v0.5.0) · [Проверка main](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/40506194978/attempts/2) · [Релизная матрица](https://github.com/michaelbrylevskii/bpmn-desk/actions/runs/40509035857)

| Среда | Unit | E2E | Flowable runtime |
| --- | --- | --- | --- |
| Ubuntu 24.04 | 90 passed | 77 passed, включая AppImage | 15 passed |
| Windows Server 2022 | 88 passed, 2 symlink skip | 75 passed, включая готовый EXE | 15 passed |

Обе матрицы прошли strict TypeScript, ESLint, нативную сборку и официальные Flowable converter 7.2 / Camunda Model API 7.24.

Первый Linux-job проверки main остановлен после длительного ожидания пакетов с зеркала Ubuntu. Повторный запуск на свежем runner прошёл без изменения исходников; успешный результат Windows сохранён. Релизная матрица прошла с первой попытки.

## Покрытие

- Копирование между схемами: Flowable/Camunda 7, группы, связи, подпроцессы, граничные события, namespace и расширения; буфер после закрытия источника и независимые истории undo/redo.
- Конфликты ID определений Error/Message/Signal/Escalation, повторная вставка с переиспользованием определения и отмена без удаления уже используемых определений.
- Перестановка вкладок мышью и клавиатурой, сохранение активной вкладки, содержимого и истории команд.
- Поток по умолчанию из свойств стрелки и узла: замена, снятие, undo/redo и исходящие связи без явных outgoing в XML.
- В собранной AppImage отдельно проверены копирование между схемами, перетаскивание вкладок, независимый undo и стандартный default-поток.
- Roundtrip, формы движков, XML, темы, локализация, экспорт, файлы/CLI/recent, recovery, уведомления и dirty state.
- Реальный Flowable/H2: точная версия схемы, multi-instance, переменные, dead-letter, stacktrace, связи экземпляров, фильтры, авторизация и таймауты.

## Артефакты

AppImage, installer, portable и `SHA256SUMS` собраны релизным GitHub Actions. Все четыре файла скачаны: размеры и SHA-256 совпадают с manifest и GitHub asset.digest. Тег указывает на проверенный коммит, релиз опубликован как latest. Описание совпадает с генератором: английский текст и русский перевод в закрытом details.

Опубликованная AppImage распакована: версия 0.5.0, все семь файлов скомпилированного out, примеры, provenance и лицензии совпадают с локальной сборкой проверенного исходника. Корень ASAR содержит только out, node_modules, package.json, LICENSE и THIRD_PARTY_NOTICES.md. Тесты, Java, кеши и пользовательские данные исключены из поставки.

| Дистрибутив | Размер, байт | SHA-256 |
| --- | ---: | --- |
| Linux AppImage x86_64 | 132283550 | `47639f3b47885559fc2c5200d2c39933ff097a1c2e3a69ecf09cccc3cc3a22b8` |
| Windows installer x64 | 115911737 | `4f93d34462249509ceb60e30e03c57bd8628d1563b9519c17c755254efe7f434` |
| Windows portable x64 | 115748713 | `e36f94dcc96d31e85cde34c3cee99c1c00ebcecaa5f51bd1ea1e07efe7439b51` |

## Границы подтверждения

Windows проверена автоматическим запуском приложения, без ручной приёмки installer/portable launcher и ассоциаций. macOS не проверялась. AppImage проверяется с распаковкой без FUSE.

Flowable/H2 — независимый стенд с условными данными. Production SQL/count не оптимизирован; настройка таймаута позволяет дольше ждать ответа. Пользовательские серверы и корпоративная авторизация не входят в тесты. Model API не выполняет deployment, delegates или scripts.

[Воспроизведение](development.md) · [Исторические протоколы](archive/README.md)
