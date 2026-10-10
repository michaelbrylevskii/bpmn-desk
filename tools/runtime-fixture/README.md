# Независимый Flowable-стенд

Тестовое приложение Spring Boot 3.5.0, Flowable 7.2.0 и H2 в памяти. Зависимости Java используются только в тестах и не входят в дистрибутив BPMN Desk.

Сервер слушает `127.0.0.1` на свободном порту. REST root — `/process-api/`. Тестовая учётная запись: `desk-reader`, пароль `fixture-password`. Security filter разрешает авторизованные GET, остальные методы запрещены. Эти реквизиты предназначены исключительно для стенда.

При запуске стенд создаёт:

- Две версии определения `deskReview` и экземпляр первой версии с длинным business key для проверки переноса текста.
- Параллельный `deskParallel` с одной задачей владельца и тремя multi-instance задачами, включая локальную переменную execution.
- `deskFailure`, в котором настоящий async executor выполняет падающий Java delegate и переводит задание в dead-letter с сохранённым stacktrace.
- `deskParent`, вызывающий дочерний процесс.

Все схемы оригинальные, лицензия MIT. Их происхождение и SHA-256 находятся в `src/main/resources/processes/provenance.json`. Они не встроены в приложение. Данные H2 исчезают после завершения сервера.

Для ручного запуска нужны JDK 17+ и Maven:

```bash
mvn -q -f tools/runtime-fixture/pom.xml compile dependency:build-classpath -Dmdep.outputFile=target/classpath.txt
mkdir -p .cache/runtime-manual
BPMN_DESK_FIXTURE_OUTPUT="$PWD/.cache/runtime-manual/ready.json" \
  java -cp "tools/runtime-fixture/target/classes:$(cat tools/runtime-fixture/target/classpath.txt)" \
  org.bpmndesk.runtimefixture.FixtureApplication
```

После готовности движка и dead-letter job файл `ready.json` содержит REST root и идентификаторы экземпляров. На Windows разделитель Java classpath — `;`. Автоматические проверки запускают сервер с отдельным временным каталогом и завершают его после тестов.
