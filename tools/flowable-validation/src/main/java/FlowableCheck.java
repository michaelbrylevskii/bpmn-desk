import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Locale;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.stream.XMLInputFactory;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.w3c.dom.Element;

/** Независимая проверка семантики исходных и экспортированных схем конвертером Flowable. */
public final class FlowableCheck {
    private FlowableCheck() {}

    public static void main(String[] args) throws Exception {
        if (args.length < 2 || args.length > 3) throw new IllegalArgumentException("Нужны каталоги оригиналов и экспортов, опционально имя схемы");
        if (args.length == 3) {
            compare(Path.of(args[0]).resolve(args[2]), Path.of(args[1]).resolve(args[2]));
            return;
        }
        try (var paths = Files.list(Path.of(args[0]))) {
            for (var source : paths.filter(p -> Files.isRegularFile(p) && p.toString().toLowerCase(Locale.ROOT).matches(".*\\.(bpmn|xml)$")).sorted().toList()) {
                compare(source, Path.of(args[1]).resolve(source.getFileName()));
            }
        }
    }

    private static void compare(Path source, Path exported) throws Exception {
        if (!converted(source).equals(converted(exported))) {
            throw new IllegalStateException("Изменилась Flowable-семантика: " + exported);
        }
        System.out.println("Flowable 7.2: OK " + exported);
    }

    private static String converted(Path path) throws Exception {
        var inputFactory = XMLInputFactory.newFactory();
        inputFactory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
        inputFactory.setProperty("javax.xml.stream.isSupportingExternalEntities", false);
        var converter = new BpmnXMLConverter();
        byte[] output;
        try (var input = Files.newInputStream(path)) {
            var reader = inputFactory.createXMLStreamReader(input, StandardCharsets.UTF_8.name());
            try {
                var model = converter.convertToBpmnModel(reader);
                // DI проверяется UI-тестами. Здесь проверяем исполняемую модель.
                model.getLocationMap().clear();
                model.getLabelLocationMap().clear();
                model.getFlowLocationMap().clear();
                output = converter.convertToXML(model);
            } finally { reader.close(); }
        }
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        try (var stream = new ByteArrayInputStream(output)) {
            return canonical(factory.newDocumentBuilder().parse(stream).getDocumentElement());
        }
    }

    private static String canonical(Element element) {
        var attributes = new ArrayList<String>();
        for (var i = 0; i < element.getAttributes().getLength(); i++) {
            var attribute = element.getAttributes().item(i);
            if (XMLConstants.XMLNS_ATTRIBUTE_NS_URI.equals(attribute.getNamespaceURI())) continue;
            attributes.add("{" + attribute.getNamespaceURI() + "}" + attribute.getLocalName() + "=" + attribute.getNodeValue());
        }
        Collections.sort(attributes);
        var children = new StringBuilder();
        var nodes = element.getChildNodes();
        for (var i = 0; i < nodes.getLength(); i++) {
            var child = nodes.item(i);
            if (child instanceof Element childElement) children.append(canonical(childElement));
            else if (child.getNodeValue() != null && !child.getNodeValue().isBlank()) children.append(child.getNodeValue().trim());
        }
        return "{" + element.getNamespaceURI() + "}" + element.getLocalName() + attributes + "[" + children + "]";
    }
}
