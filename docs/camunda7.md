# Camunda 7

Реализовано в ветке разработки `feat/camunda-7`. Опубликованный релиз 0.2.0 этой поддержки не содержит. Теги, новые релизы и публикация ветки не выполнялись.

## Профили схем

Селектор рядом с кнопкой новой схемы задаёт профиль создаваемого документа: Flowable, Camunda 7 или обычный BPMN 2.0. Он действует для кнопок создания, Ctrl+N и native меню. На уже открытые документы выбор не влияет.

Открытая схема определяется по URI, поэтому `camunda:`, `c7:` и другие префиксы эквивалентны при правильном объявлении. Использованные пространства имён важнее оставшихся неиспользуемых объявлений. Для пустой схемы профиль хранится объявлением namespace в XML и восстанавливается при повторном открытии. Обычный BPMN не получает формы или предупреждения Flowable/Camunda.

Если реально используются оба движка, доступны обе группы свойств и предупреждение о смешанной схеме. Это позволяет редактировать существующий XML, но не превращает процесс в исполняемый на двух движках. Автоматической конвертации Flowable ↔ Camunda нет.

## Формы

- Реализация service/send/business rule tasks: Java class, expression, delegateExpression, external task type/topic/priority; результат выражения, asyncBefore/asyncAfter, exclusive и jobPriority.
- User tasks: assignee, candidate users/groups, due/follow-up date, priority; formKey, formRef/binding/version и formHandlerClass.
- Process: historyTimeToLive, versionTag, candidate starters и доступность запуска в Tasklist. Start event: initiator и ссылки на форму.
- Call activity: binding, version/versionTag/tenant, variable mapping delegates; расширения `in`/`out` с businessKey, variables и local.
- Business rule task: ссылки и версии DMN, tenant, способ извлечения результата. Сам DMN-файл не редактируется.
- Script task: стандартные BPMN script/scriptFormat, Camunda resource/resultVariable. Scripts остаются текстом.
- Event definitions: реализация message throw/end, переменные ошибок и эскалаций, переменные conditional event. Multi-instance: collection, elementVariable, async/exclusive и retry. Значения применяются к вложенному target.
- Definitions ошибок: `camunda:errorMessage`, с поддержкой альтернативного префикса.

Атрибуты показывают явное наличие значения. Boolean допускает удаление атрибута; для Camunda показаны документированные умолчания async/exclusive/startable. Удаление значения не записывает умолчание в XML.

## Вложенные расширения

В секциях свойств доступны добавление, удаление и изменение узлов:

- executionListener/taskListener и вложенные field/script;
- inputOutput, inputParameter/outputParameter, text/expression, map/entry, list/value и script;
- formData/formField, enum values, properties/property, validation/constraint; устаревший formProperty;
- connector, connectorId и вложенные параметры;
- properties и errorEventDefinition внешней задачи.

Контейнеры inputOutput/formData/properties/connector и одиночные вложенные контейнеры не дублируются кнопкой добавления. Новые formField получают свободный ID среди соседних полей. Пустые обязательные поля и прикладная конфигурация остаются ответственностью автора схемы; редактор допускает промежуточное состояние.

Переключение параметра между текстом, script, list и map заменяет прежний тип значения одной командой. Undo возвращает прежние данные. Изменение field из атрибута stringValue/expression переводит его в дочерний string/expression без сохранения конфликтующих представлений. Назначение внешнего resource скрипта очищает встроенное тело, также с undo.

Неизвестные дочерние элементы сохраняются. Их можно изменить в XML расширений или исходнике всей схемы. Редактирование известных полей не пересобирает остальные атрибуты и детей. Смена типа задачи и copy/paste сохраняют generic данные; при вставке глобальный ID расширения ошибки получает новое значение.

## Примеры и проверки

`camunda7-showcase` демонстрирует формы, external task, listeners, параметры, DMN binding, call activity и скрипт. `camunda7-integration` использует префикс `c7`, connector, multi-instance, boundary error и message end event. Оба примера созданы авторами BPMN Desk по MIT; SHA-256 и происхождение находятся в `examples/provenance.json`. Java delegates, endpoint, вызванный процесс и решение DMN в примерах условные и не поставляются.

```bash
npm run check
npm run package:linux
npm run test:e2e
npm run validate:flowable
npm run validate:camunda
```

Camunda-проверка требует JDK 17+ и Maven. Она читает экспорты UI из `.cache/camunda-exports/`, сравнивает модель исходных и сохранённых примеров через официальную BPMN Model API 7.24.0, проверяет изменённый integration против отдельно построенного ожидаемого XML и валидирует результат copy/paste. В сравнении исключён DI; текстовые значения не обрезаются. Координаты и отображение проверяются UI-тестами. Java не включается в дистрибутив.

Пользовательские наборы по-прежнему можно дополнительно прогнать через `npm run test:extra`: auto detection, roundtrip и UI общие. `validate:flowable:extra` относится к Flowable; независимого Camunda-конвертера внешних наборов пока нет. Основной набор самодостаточен.

## Границы

Целевая спецификация — Camunda 7.24. Camunda 8/Zeebe, CMMN/DMN редакторы, deployment, выполнение Java/scripts и дизайнер внешних `.form` файлов не включены. Ссылки на эти ресурсы сохраняются.

Model API и диагностика не заменяют deployment-проверку движком с реальными delegates, forms, connectors и tenant. Редкие и проектные расширения, например timer task listeners, доступны через XML. XML-конструкции, которые невозможно сохранить через moddle, блокируют импорт/сохранение.

Архитектурное решение: [ADR 0014](adr/0014-engine-profiles.md). Результаты прогона: [validation-camunda7.md](validation-camunda7.md).
