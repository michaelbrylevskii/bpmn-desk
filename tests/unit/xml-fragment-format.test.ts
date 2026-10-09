import { describe, expect, it } from 'vitest';
import { extensionsXml, parseExtensions } from '../../src/renderer/bpmn/codec';
import { canonicalElement, parseXml, serializeXml } from '../../src/renderer/bpmn/xml';
import { formatXmlFragment } from '../../src/renderer/bpmn/xml-fragment-format';

describe('отступы отдельного XML-фрагмента', () => {
  it('выравнивает корень и вложенные теги, не меняя исходное дерево', () => {
    const original = '<root xmlns:c="urn:custom">\n        <!-- kept -->\n        <c:outer flag="a &amp; b">\n          <c:value>text</c:value>\n        </c:outer>\n      </root>';
    const document = parseXml(original);
    const formatted = formatXmlFragment(document.documentElement);
    expect(formatted).toBe('<root xmlns:c="urn:custom">\n  <!-- kept -->\n  <c:outer flag="a &amp; b">\n    <c:value>text</c:value>\n  </c:outer>\n</root>');
    expect(serializeXml(document.documentElement)).toBe(original);
    expect(canonicalElement(parseXml(formatted).documentElement)).toBe(canonicalElement(document.documentElement));
  });

  it('сохраняет значимый текст, CDATA, mixed content и xml:space', () => {
    const original = '<root>\n    <script>\n      if (a &lt; 2) {\n        run();\n      }\n    </script>\n    <data><![CDATA[\n  a < b\n    text\n]]></data>\n    <mixed> before <child/> after </mixed>\n    <keep xml:space="preserve">\n         <nested/>  \n    </keep>\n  </root>';
    const before = parseXml(original);
    const after = parseXml(formatXmlFragment(before.documentElement));
    for (const tag of ['script', 'data', 'mixed', 'keep']) {
      expect(serializeXml(after.getElementsByTagName(tag)[0]!)).toBe(serializeXml(before.getElementsByTagName(tag)[0]!));
    }
  });

  it('сохраняет неразрывные пробелы между тегами как значимый текст', () => {
    const source = parseXml('<root><value>\u00a0<child/>\u00a0</value></root>');
    const result = parseXml(formatXmlFragment(source.documentElement));
    expect(result.getElementsByTagName('value')[0]!.textContent).toBe('\u00a0\u00a0');
    expect(canonicalElement(result.documentElement)).toBe(canonicalElement(source.documentElement));
  });

  it('учитывает унаследованный xml:space и явный сброс default на корне', () => {
    const source = parseXml('<host xml:space="preserve"><root>\n      <child/>\n    </root><reset xml:space="default">\n      <child/>\n    </reset></host>');
    const root = source.getElementsByTagName('root')[0]!;
    expect(formatXmlFragment(root)).toBe(serializeXml(root));
    expect(formatXmlFragment(source.getElementsByTagName('reset')[0]!)).toBe('<reset xml:space="default">\n  <child/>\n</reset>');
  });

  it('применяет оформленный блок с исходными namespace и значениями расширений', async () => {
    const source = '<b:definitions xmlns:b="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:c="urn:custom" targetNamespace="test"><b:process id="p"><b:serviceTask id="t"><b:extensionElements>\n        <c:outer>\n          <c:value>  user value  </c:value>\n        </c:outer>\n      </b:extensionElements></b:serviceTask></b:process></b:definitions>';
    const fragment = extensionsXml(source, 't');
    expect(fragment.split('\n').slice(1)).toEqual(['  <c:outer xmlns:c="urn:custom">', '    <c:value>  user value  </c:value>', '  </c:outer>', '</b:extensionElements>']);
    const extension = await parseExtensions(fragment, source);
    expect(extension?.get<unknown[]>('values')).toHaveLength(1);
    expect(extensionsXml(source, 'p')).toBe('<bpmn:extensionElements />');
  });
});
