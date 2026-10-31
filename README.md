<div align="center">

# BPMN Desk

**Desktop BPMN editor and process monitor**

BPMN 2.0 · Flowable · Camunda 7<br>
Linux and Windows · local files · open source

[**Download**](https://github.com/michaelbrylevskii/bpmn-desk/releases/latest) · [Русский](README.ru.md) · [Documentation](docs/README.md)

</div>

![BPMN Desk editor in light and dark themes](docs/images/hero.png)

<table>
<tr>
<td width="25%"><a href="docs/images/start.png"><img src="docs/images/start.png" alt="Start page" width="100%"></a><br><sub>Start page</sub></td>
<td width="25%"><a href="docs/images/camunda.png"><img src="docs/images/camunda.png" alt="Camunda 7 properties" width="100%"></a><br><sub>Camunda 7</sub></td>
<td width="25%"><a href="docs/images/monitor.png"><img src="docs/images/monitor.png" alt="Flowable monitor and dead-letter jobs" width="100%"></a><br><sub>Flowable monitor</sub></td>
<td width="25%"><a href="docs/images/history.png"><img src="docs/images/history.png" alt="Flowable execution history linked to its deployed diagram" width="100%"></a><br><sub>Execution history</sub></td>
</tr>
</table>

## Features

- **Visual BPMN editor** with Flowable and Camunda 7 properties and extensions.
- **XML editor** with syntax highlighting, search and direct access to the diagram source.
- **Flexible workspace** with reorderable tabs, copying between diagrams, independent undo/redo and draft recovery.
- **Flowable monitor** with current state and execution history linked to the diagram, process summaries, variables and error details.
- **SVG and PNG export**, including process state and history markers.
- **English and Russian**, light and dark themes, and adjustable interface and diagram zoom.

Edit local files without an account or cloud upload. Connect the read-only monitor to your own Flowable REST API.

## Engine support

| | Editing | Monitoring |
| --- | --- | --- |
| BPMN 2.0 | Standard diagrams | — |
| Flowable | Engine properties and extensions | Current state and execution history |
| Camunda 7 | Engine properties and extensions | — |

## Download

The [latest release](https://github.com/michaelbrylevskii/bpmn-desk/releases/latest) includes a **Linux x86_64 AppImage**, a **Windows x64 installer and portable app**, and `SHA256SUMS`. Node.js and Java are not required to run the app.

```bash
chmod +x BPMN-Desk-*.AppImage
./BPMN-Desk-0.6.1-x86_64.AppImage
```

Without FUSE, use `--appimage-extract-and-run` as the first argument. Windows executables are unsigned; macOS is not available yet.

## Scope

- Visual editing requires diagram layout (BPMN DI). Automatic layout and conversion between engines are not provided; saving may reformat XML.
- Monitoring is read-only and targets Flowable REST 7.2. History depends on retained engine data; summaries use limited samples.
- Process execution and deployment, DMN/CMMN and Camunda 8/Zeebe are outside the app's scope.

See the [monitor documentation](docs/runtime-monitor.md) and [file/export limits](docs/requirements.md#ограничения-файлов-и-экспорта) for details.

## Development and license

Electron · React · TypeScript · bpmn-js · CodeMirror. [Development and checks](docs/development.md) · [Architecture](docs/architecture.md) · [Release validation](docs/validation.md). Project documentation is in Russian.

Code: [MIT](LICENSE). Bundled examples have explicit [provenance and licenses](examples/provenance.json). [Third-party notices](THIRD_PARTY_NOTICES.md).
