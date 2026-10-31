<div align="center">

# BPMN Desk

**Редактор BPMN и монитор процессов для рабочего стола**

BPMN 2.0 · Flowable · Camunda 7<br>
Linux и Windows · локальные файлы · открытый исходный код

[**Скачать**](https://github.com/michaelbrylevskii/bpmn-desk/releases/latest) · [English](README.md) · [Документация](docs/README.md)

</div>

![Редактор BPMN Desk: светлая и тёмная темы](docs/images/hero.png)

<table>
<tr>
<td width="25%"><a href="docs/images/start.png"><img src="docs/images/start.png" alt="Стартовая страница" width="100%"></a><br><sub>Стартовая страница</sub></td>
<td width="25%"><a href="docs/images/camunda.png"><img src="docs/images/camunda.png" alt="Свойства Camunda 7" width="100%"></a><br><sub>Camunda 7</sub></td>
<td width="25%"><a href="docs/images/monitor.png"><img src="docs/images/monitor.png" alt="Монитор Flowable и dead-letter" width="100%"></a><br><sub>Монитор Flowable</sub></td>
<td width="25%"><a href="docs/images/history.png"><img src="docs/images/history.png" alt="История Flowable с привязкой к развёрнутой схеме" width="100%"></a><br><sub>История выполнения</sub></td>
</tr>
</table>

## Возможности

- **Визуальный редактор BPMN** со свойствами и расширениями Flowable и Camunda 7.
- **XML-редактор** с подсветкой синтаксиса, поиском и прямым доступом к исходному коду схемы.
- **Удобное рабочее пространство** с перестановкой вкладок, копированием между схемами, независимым undo/redo и восстановлением черновиков.
- **Монитор Flowable** с текущим состоянием и историей выполнения на схеме, сводками по процессам, переменными и подробностями ошибок.
- **Экспорт в SVG и PNG**, включая метки состояния и истории процессов.
- **Русский и английский языки**, светлая и тёмная темы, масштабирование интерфейса и схемы.

Редактируй локальные файлы без аккаунта и загрузки в облако. Подключай монитор к своему Flowable REST API для просмотра процессов.

## Поддержка движков

| | Редактирование | Мониторинг |
| --- | --- | --- |
| BPMN 2.0 | Стандартные схемы | — |
| Flowable | Свойства и расширения движка | Текущее состояние и история выполнения |
| Camunda 7 | Свойства и расширения движка | — |

## Скачать

[Последний релиз](https://github.com/michaelbrylevskii/bpmn-desk/releases/latest) содержит **AppImage для Linux x86_64**, **установщик и portable для Windows x64**, а также `SHA256SUMS`. Node.js и Java для запуска не нужны.

```bash
chmod +x BPMN-Desk-*.AppImage
./BPMN-Desk-0.6.1-x86_64.AppImage
```

Без FUSE: `--appimage-extract-and-run` первым аргументом. Windows EXE не подписаны; macOS пока не поставляется.

## Границы

- Для визуального редактирования нужна раскладка схемы (BPMN DI). Автоматической раскладки и конвертации между движками нет; сохранение может менять форматирование XML.
- Монитор работает только на чтение с Flowable REST 7.2. История зависит от сохранённых данных движка; сводки используют ограниченные выборки.
- Исполнение и развёртывание процессов, DMN/CMMN и Camunda 8/Zeebe не входят в возможности приложения.

Подробнее — в [документации монитора](docs/runtime-monitor.md) и [ограничениях файлов и экспорта](docs/requirements.md#ограничения-файлов-и-экспорта).

## Разработка и лицензия

Electron · React · TypeScript · bpmn-js · CodeMirror. [Разработка и проверки](docs/development.md) · [Архитектура](docs/architecture.md) · [Результаты релиза](docs/validation.md).

Код — [MIT](LICENSE). Встроенные примеры имеют [provenance и лицензии](examples/provenance.json). [Сторонние компоненты](THIRD_PARTY_NOTICES.md).
