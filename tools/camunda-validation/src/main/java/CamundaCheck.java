import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.camunda.bpm.model.bpmn.Bpmn;
import org.camunda.bpm.model.bpmn.BpmnModelInstance;
import org.camunda.bpm.model.bpmn.instance.ServiceTask;
import org.w3c.dom.Element;

/** Официальная Model API проверяет XML; канонизация сравнивает модель без DI. */
public final class CamundaCheck {
    private CamundaCheck() {}

    public static void main(String[] args) throws Exception {
        if (args.length < 2) throw new IllegalArgumentException("Нужны исходный и экспортированный BPMN");
        var source = validated(Path.of(args[0]));
        var exported = validated(Path.of(args[1]));
        if (!canonical(source).equals(canonical(exported))) throw new IllegalStateException("Изменилась BPMN/Camunda-семантика: " + args[1]);
        // Проверяем доступ к типизированному расширению независимо от generic модели JS.
        if (args.length == 3 && args[2].equals("showcase")) {
            ServiceTask task = exported.getModelElementById("ArchiveOrder");
            if (task == null || !"external".equals(task.getCamundaType()) || !"archive-order".equals(task.getCamundaTopic())) {
                throw new IllegalStateException("Model API не распознала external task");
            }
        }
        System.out.println("Camunda Model API 7.24: OK " + args[1]);
    }

    private static BpmnModelInstance validated(Path path) throws Exception {
        var bytes = Files.readAllBytes(path);
        // DTD и внешние entities отклоняются до передачи стороннему parser.
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        try (var input = new ByteArrayInputStream(bytes)) {
            var document = factory.newDocumentBuilder().parse(input);
            var ids = new HashSet<String>();
            var nodes = document.getElementsByTagName("*");
            for (var i = 0; i < nodes.getLength(); i++) {
                var element = (Element) nodes.item(i);
                var global = "http://www.omg.org/spec/BPMN/20100524/MODEL".equals(element.getNamespaceURI()) ||
                    ("http://camunda.org/schema/1.0/bpmn".equals(element.getNamespaceURI()) && "errorEventDefinition".equals(element.getLocalName()));
                var id = element.getAttribute("id");
                if (global && !id.isEmpty() && !ids.add(id)) throw new IllegalStateException("Повтор глобального BPMN ID: " + id);
            }
        }
        try (var input = new ByteArrayInputStream(bytes)) {
            var model = Bpmn.readModelFromStream(input);
            Bpmn.validateModel(model);
            return model;
        }
    }

    private static String canonical(BpmnModelInstance model) throws Exception {
        var factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
        try (var input = new ByteArrayInputStream(Bpmn.convertToString(model).getBytes(StandardCharsets.UTF_8))) {
            return canonical(factory.newDocumentBuilder().parse(input).getDocumentElement());
        }
    }

    private static String canonical(Element element) {
        if ("http://www.omg.org/spec/BPMN/20100524/DI".equals(element.getNamespaceURI())) return "";
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
            else if (child.getNodeValue() != null && !child.getNodeValue().isBlank()) children.append(child.getNodeValue());
        }
        return "{" + element.getNamespaceURI() + "}" + element.getLocalName() + attributes + "[" + children + "]";
    }
}
