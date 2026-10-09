# Сторонние компоненты

Основные зависимости закреплены точными версиями в package.json и package-lock.json.

| Компонент | Назначение | Лицензия |
|---|---|---|
| Electron | Desktop runtime | MIT; Chromium имеет собственные notices |
| React | Интерфейс | MIT |
| bpmn-js | BPMN-моделер | bpmn.io license (MIT с требованием сохранять watermark) |
| bpmn-moddle | BPMN XML-модель | MIT |
| CodeMirror | XML-редактор и поиск | MIT |
| @lezer/xml | Синтаксическое дерево для XML-навигации | MIT |
| lucide-react | Иконки UI | ISC |
| @xmldom/xmldom | XML DOM | MIT |
| @resvg/resvg-js | Сборка PNG из собственного SVG приложения | MPL-2.0, только build tool |
| Flowable BPMN converter | Дополнительная независимая проверка | Apache-2.0, только test tool |
| Camunda BPMN Model API 7.24.0 | Проверка XML и семантики Camunda 7 | Apache-2.0, только test tool |

Watermark bpmn.io остаётся полностью видимым на холсте. Оригинальные LICENSE зависимости находятся в установленных npm-пакетах; electron-builder включает production dependencies в app.asar. Дистрибутив также содержит LICENSE.electron.txt и LICENSES.chromium.html.

Собственный код и оригинальные материалы распространяются по MIT. Заимствованные схемы Flowable — по Apache-2.0; полные тексты лицензий и происхождение поставляются вместе с приложением. См. [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). `private: true` предотвращает публикацию desktop-проекта в npm и не определяет видимость Git-репозитория.
