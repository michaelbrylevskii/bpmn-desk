# Дополнительные локальные схемы

Пользовательский пакет дополняет основной набор проверок, не меняет встроенные примеры и не включается в Git или дистрибутив. Входные файлы runner не изменяет.

## Формат

```text
my-schema-pack/
  schemas/
    process.bpmn20.xml
  provenance.json
```

```json
[
  {
    "file": "process.bpmn20.xml",
    "sha256": "<64 hex-символа, SHA-256 исходных байтов>",
    "source": "локальный источник"
  }
]
```

Обязательны `file` и `sha256`. Каждый `.bpmn`/`.xml` имеет одну запись; имена не содержат каталогов, ссылки за пределы пакета отклоняются. Сумма учитывает BOM. Дополнительные поля provenance runner не интерпретирует.

Пакет хранится вне репозитория или в `.local-schemas/`. Он не должен пересекаться с каталогами результатов, в том числе через symlink: новые результаты очищаются перед прогоном. Provenance после намеренного изменения входа обновляется вручную.

## Проверка

```bash
BPMN_DESK_EXTRA_SCHEMAS=/absolute/path/to/my-schema-pack npm run test:extra
BPMN_DESK_EXTRA_SCHEMAS=/absolute/path/to/my-schema-pack npm run validate:flowable:extra
```

В PowerShell переменная задаётся через `$env:BPMN_DESK_EXTRA_SCHEMAS`. Окружение — по [инструкции разработки](development.md); конвертер дополнительно требует JDK 17+ и Maven.

Первый прогон проверяет checksum, двойной roundtrip и UI; отсутствие DI пропускает только UI. Receipt `completed.json` связывает входы и экспорты. Конвертер запускается после него, сравнивает модели без DI и отклоняет изменённые или незавершённые результаты. Camunda-конвертер внешних пакетов не предоставляется.

Выходы — `.cache/extra-schema-exports/` и `.cache/extra-test-results/`; они могут содержать пользовательский XML и остаются локальными. Обычные `check`, `test:e2e` и `validate:flowable` от переменной не зависят.
