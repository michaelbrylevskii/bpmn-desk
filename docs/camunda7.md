# Расширения Camunda 7

Целевая спецификация — Camunda 7.24. Редактор настраивает и сохраняет расширения; движок не выполняется внутри приложения.

## Формы

| Область | Поддержка |
| --- | --- |
| Service/send/business rule task | class/expression/delegate, external topic/priority, asyncBefore/After, exclusive, jobPriority |
| User task и формы | assignee/candidates, due/follow-up, priority, formKey/ref/binding/version/handler |
| Process и start event | historyTimeToLive, versionTag, candidate starters, Tasklist, initiator |
| Call activity | binding/version/tenant, variable mapping delegates, in/out и businessKey |
| DMN и script task | Ссылки на решение и параметры результата; script/resource/resultVariable |
| Events и multi-instance | Message implementation, error/escalation/conditional variables, collection, elementVariable, async/retry |

Вложенные расширения: listeners с field/script, input/output с text/map/list/script, formData с enum/properties/validation, connector, properties и errorEventDefinition.

## Сохранность модели

Профиль определяется по URI, а не XML-префиксу. Смешанная схема показывает обе группы свойств; конвертации между движками нет.

Изменения вложенных параметров проходят через одну отменяемую команду. Конфликтующие представления field и script заменяются явно; неизвестные атрибуты и дочерние узлы сохраняются. Copy/paste и смена типа задачи сохраняют расширения; глобальные ID при вставке получают новые значения. Значение по умолчанию не записывается вместо удалённого атрибута.

Редкие расширения доступны через XML. Неподдерживаемые конструкции, которые moddle не может сохранить, блокируют импорт/сохранение. Проверка Model API подтверждает XML и семантику, но не прикладную корректность delegates, connectors, forms или tenant.

Camunda 8/Zeebe, runtime Camunda 7, редактирование DMN/CMMN и внешних `.form` файлов не включены. Ссылки на ресурсы сохраняются.

[Примеры и лицензии](../examples/provenance.json) · [ADR 0014](adr/0014-engine-profiles.md) · [Проверки моделей](development.md)
