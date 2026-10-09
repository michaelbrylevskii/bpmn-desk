# Сторонние материалы

Код BPMN Desk, документация, оформление и оригинальные схемы распространяются по [MIT](LICENSE). Сторонние компоненты и заимствованные примеры сохраняют свои лицензии; MIT приложения их не заменяет.

## Иконка приложения

Символ `Workflow` в интерфейсе и `build/icon.svg` взят из `lucide-react@1.53.0` по ISC. Геометрия сохранена, цвета и масштаб адаптированы к оформлению BPMN Desk. Copyright (c) 2026 Lucide Icons and Contributors. Полный текст лицензии поставляется в [licenses/lucide-ISC.txt](licenses/lucide-ISC.txt).

## Примеры Flowable

`vacation-request.bpmn20.xml`, `vacation-approval.bpmn20.xml` и `table-reservation.bpmn20.xml` взяты из публичного репозитория [flowable/flowable-examples](https://github.com/flowable/flowable-examples) по Apache License 2.0. XML не изменён; локальные имена файлов отличаются от upstream. Полный текст лицензии находится в [licenses/flowable-examples-APACHE-2.0.txt](licenses/flowable-examples-APACHE-2.0.txt).

Исходные пути, закреплённая revision, SHA-256 и лицензия каждого файла указаны в [examples/provenance.json](examples/provenance.json). `flowable-showcase.bpmn20.xml` и `boundary-events.bpmn20.xml` созданы авторами BPMN Desk независимо и распространяются по MIT.

## Зависимости

Обзор: [docs/third-party.md](docs/third-party.md). Тексты лицензий runtime-зависимостей поставляются с npm-пакетами внутри `app.asar`; Electron также содержит `LICENSE.electron.txt` и `LICENSES.chromium.html`. Watermark bpmn.io сохраняется согласно лицензии bpmn-js. Полный текст лицензии приложения, этот документ и каталог `licenses/` включаются в desktop-дистрибутивы.
