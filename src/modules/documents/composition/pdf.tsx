import { Fragment } from "react";
import { Circle, Document, Ellipse, Image, Line, Page, Path, Rect, Svg, Text, View, pdf } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { layoutDiagram } from "@/modules/documents/composition/diagram";
import { solidFill } from "@/modules/documents/composition/frames";
import { diagramOf, itemsOf, splitTableRows, tableOf, textOf } from "@/modules/documents/composition/read";
import type { Block, CompositionDocument, Fill } from "@/modules/documents/composition/schema";
import { getDocumentTheme, pagePoints, type DocumentTheme } from "@/modules/documents/composition/theme";

export async function renderCompositionPdfBuffer(doc: CompositionDocument): Promise<Buffer> {
  const theme = getDocumentTheme(doc.theme.id);
  const blob = await pdf(<CompositionPdf doc={doc} theme={theme} />).toBlob();
  return Buffer.from(await blob.arrayBuffer());
}

const PX_TO_PT = 72 / 96;

function CompositionPdf({ doc, theme }: { doc: CompositionDocument; theme: DocumentTheme }) {
  if (doc.pages?.some((page) => page.blocks.some((node) => node.frame))) return <PlacedPdf doc={doc} theme={theme} />;
  const size = pagePoints(doc.page.size, doc.page.orientation);
  const margin = doc.page.margin;
  return (
    <Document title={doc.metadata.title}>
      <Page size={[size.width, size.height]} style={{ paddingTop: margin.top, paddingBottom: margin.bottom, paddingHorizontal: margin.left, fontSize: theme.type.body, color: theme.colors.text, fontFamily: "Helvetica" }}>
        {doc.header.show ? (
          <Text style={{ position: "absolute", top: 16, left: margin.left, right: margin.right, fontSize: theme.type.caption, color: theme.colors.muted }} fixed>
            {doc.header.text || doc.metadata.title}
          </Text>
        ) : null}
        {doc.sections.flatMap((section) => section.blocks.map((node) => <PdfBlock key={node.id} node={node} theme={theme} />))}
        {doc.footer.show ? (
          <Text style={{ position: "absolute", bottom: 16, left: margin.left, right: margin.right, fontSize: theme.type.caption, color: theme.colors.muted }} fixed render={({ pageNumber, totalPages }) => `${doc.footer.text || doc.metadata.title}    ${pageNumber} / ${totalPages}`} />
        ) : null}
      </Page>
    </Document>
  );
}

function PlacedPdf({ doc, theme }: { doc: CompositionDocument; theme: DocumentTheme }) {
  const size = pagePoints(doc.page.size, doc.page.orientation);
  return (
    <Document title={doc.metadata.title}>
      {(doc.pages ?? []).map((artboard) => (
        <Page key={artboard.id} size={[size.width, size.height]} style={{ backgroundColor: paint(artboard.background, "#ffffff") }}>
          {artboard.background?.type === "linear" ? (
            <Svg width={size.width} height={size.height} style={{ position: "absolute", top: 0, left: 0 }}>
              <Rect x={0} y={0} width={size.width} height={size.height} fill={artboard.background.stops[0]?.color ?? "#ffffff"} />
            </Svg>
          ) : null}
          {artboard.blocks.map((node) => <PlacedBlock key={node.id} node={node} theme={theme} />)}
          {doc.footer.show ? <Text style={{ position: "absolute", bottom: 16, right: 24, fontSize: 8, color: theme.colors.muted }}>{doc.footer.text || doc.metadata.title}</Text> : null}
        </Page>
      ))}
    </Document>
  );
}

function PlacedBlock({ node, theme }: { node: Block; theme: DocumentTheme }) {
  const frame = node.frame ?? { x: 0, y: 0, w: 80, h: 24 };
  const fill = solidFill(node.style?.fill, "transparent");
  return (
    <View style={{ position: "absolute", left: frame.x * PX_TO_PT, top: frame.y * PX_TO_PT, width: frame.w * PX_TO_PT, height: frame.h * PX_TO_PT, backgroundColor: fill === "transparent" ? undefined : fill, borderRadius: node.style?.radius, borderWidth: node.style?.borderWidth, borderColor: node.style?.border, opacity: node.style?.opacity, padding: node.style?.padding }}>
      {node.type === "shape" && node.props.kind === "clip" && typeof node.props.path === "string" ? (
        <Svg width={frame.w * PX_TO_PT} height={frame.h * PX_TO_PT} viewBox={`0 0 ${frame.w} ${frame.h}`}>
          <Path d={node.props.path} fill={solidFill(node.style?.fill, theme.colors.primary)} fillRule={node.props.op === "subtract" ? "evenodd" : "nonzero"} />
        </Svg>
      ) : node.type === "shape" && node.props.kind === "ellipse" ? (
        <Svg width={frame.w * PX_TO_PT} height={frame.h * PX_TO_PT} viewBox={`0 0 ${frame.w} ${frame.h}`}>
          <Ellipse cx={frame.w / 2} cy={frame.h / 2} rx={frame.w / 2} ry={frame.h / 2} fill={solidFill(node.style?.fill, theme.colors.accent)} />
        </Svg>
      ) : (
        <PdfBlock node={node} theme={theme} />
      )}
      {(node.children ?? []).map((child) => <PlacedBlock key={child.id} node={child} theme={theme} />)}
    </View>
  );
}

function paint(fill: Fill | undefined, fallback: string) {
  return solidFill(fill, fallback);
}

function PdfBlock({ node, theme }: { node: Block; theme: DocumentTheme }) {
  const children = node.children ?? [];
  switch (node.type) {
    case "heading": {
      const level = Number(node.props.level ?? 2);
      const size = level === 1 ? theme.type.h1 : level === 3 ? theme.type.h3 : theme.type.h2;
      return <Text style={{ fontFamily: "Helvetica-Bold", fontSize: size, marginTop: theme.space.md, marginBottom: theme.space.sm, color: theme.colors.text }} minPresenceAhead={28}>{textOf(node)}</Text>;
    }
    case "paragraph":
    case "quote":
      return <Text style={{ marginBottom: theme.space.sm, lineHeight: 1.45, color: node.type === "quote" ? theme.colors.muted : theme.colors.text }}>{textOf(node) || " "}</Text>;
    case "callout":
      return (
        <View style={{ backgroundColor: theme.colors.accent, padding: theme.space.md, borderRadius: theme.radius, marginBottom: theme.space.md }} wrap={false}>
          <Text>{textOf(node)}</Text>
          {children.map((child) => <PdfBlock key={child.id} node={child} theme={theme} />)}
        </View>
      );
    case "bullets":
    case "numbered":
    case "checklist":
      return (
        <View style={{ marginBottom: theme.space.sm }}>
          {itemsOf(node).map((item, index) => (
            <Text key={`${node.id}-${index}`} style={{ marginBottom: 2 }}>
              {node.type === "numbered" ? `${index + 1}. ` : node.type === "checklist" ? "✓ " : "• "}
              {item}
            </Text>
          ))}
        </View>
      );
    case "columns":
      return (
        <View style={{ flexDirection: "row", gap: theme.space.md, marginBottom: theme.space.md }}>
          {children.map((child) => (
            <View key={child.id} style={{ flex: 1 }}>
              <PdfBlock node={child} theme={theme} />
            </View>
          ))}
        </View>
      );
    case "stack":
      return <View style={{ marginBottom: theme.space.sm }}>{children.map((child) => <PdfBlock key={child.id} node={child} theme={theme} />)}</View>;
    case "grid": {
      const count = Math.max(1, Number(node.props.columns ?? 2));
      return (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm, marginBottom: theme.space.md }}>
          {children.map((child) => (
            <View key={child.id} style={{ width: `${Math.floor(100 / count) - 2}%` }}>
              <PdfBlock node={child} theme={theme} />
            </View>
          ))}
        </View>
      );
    }
    case "spacer":
      return <View style={{ height: Number(node.props.size ?? theme.space.md) }} />;
    case "divider":
      return <View style={{ borderBottomWidth: 0.6, borderBottomColor: theme.colors.border, marginVertical: theme.space.sm }} />;
    case "page-break":
      return <View break />;
    case "card":
      return (
        <View wrap={false} style={{ borderWidth: 0.6, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: theme.radius, padding: theme.space.md, marginBottom: theme.space.sm }}>
          {textOf(node, "icon") ? <Text style={{ fontSize: theme.type.caption, color: theme.colors.primary }}>{textOf(node, "icon")}</Text> : null}
          {textOf(node, "figure") ? <Text style={{ fontFamily: "Helvetica-Bold", fontSize: theme.type.h1, color: theme.colors.primary }}>{textOf(node, "figure")}</Text> : null}
          {textOf(node, "title") ? <Text style={{ fontFamily: "Helvetica-Bold", marginBottom: 2 }}>{textOf(node, "title")}</Text> : null}
          {textOf(node, "body") ? <Text style={{ color: theme.colors.muted, fontSize: theme.type.caption }}>{textOf(node, "body")}</Text> : null}
          {children.map((child) => <PdfBlock key={child.id} node={child} theme={theme} />)}
        </View>
      );
    case "image": {
      const src = textOf(node, "src");
      if (!src || !/^https:\/\//.test(src)) return <Text style={{ color: theme.colors.muted }}>{textOf(node, "alt") || "Image"}</Text>;
      const frame = node.props.frame === "phone" || node.props.frame === "browser";
      return (
        <View style={frame ? { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 6, alignSelf: "flex-start" } : {}}>
          <Image src={src} style={{ width: frame ? 120 : 180, objectFit: "contain" }} />
        </View>
      );
    }
    case "table":
      return <PdfTable node={node} theme={theme} />;
    case "diagram":
      return <PdfDiagram node={node} theme={theme} />;
    case "button":
      return <Text style={{ color: node.style?.color ?? "#ffffff", fontSize: node.style?.fontSize ?? theme.type.body, textAlign: "center" }}>{textOf(node, "label") || "Button"}</Text>;
    case "frame":
      return null;
    case "signature":
      return (
        <View style={{ flexDirection: "row", gap: theme.space.lg, marginTop: theme.space.lg }} wrap={false}>
          {[textOf(node, "left") || "Provider", textOf(node, "right") || "Client"].map((party) => (
            <View key={party} style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", color: theme.colors.primary, fontSize: theme.type.caption }}>{party}</Text>
              <View style={{ borderBottomWidth: 0.8, borderBottomColor: theme.colors.text, marginTop: 28 }} />
              <Text style={{ fontSize: theme.type.caption, color: theme.colors.muted, marginTop: 4 }}>Signature</Text>
            </View>
          ))}
        </View>
      );
    default:
      return children.length ? <View>{children.map((child) => <PdfBlock key={child.id} node={child} theme={theme} />)}</View> : null;
  }
}

function PdfTable({ node, theme }: { node: Block; theme: DocumentTheme }) {
  const { columns, rows } = tableOf(node);
  const chunks = splitTableRows(rows, 14);
  return (
    <View style={{ marginBottom: theme.space.md }}>
      {chunks.map((chunk, chunkIndex) => (
        <View key={`${node.id}-${chunkIndex}`} style={{ marginBottom: theme.space.sm }}>
          <View style={{ flexDirection: "row", backgroundColor: theme.colors.accent }} wrap={false}>
            {columns.map((column) => (
              <Text key={column.key} style={cellStyle(theme, true)}>{column.label}</Text>
            ))}
          </View>
          {chunk.map((row, rowIndex) => (
            <View key={`${node.id}-r${chunkIndex}-${rowIndex}`} style={{ flexDirection: "row" }} wrap={false}>
              {columns.map((column) => (
                <Text key={column.key} style={cellStyle(theme, false)}>{row[column.key] || ""}</Text>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

function cellStyle(theme: DocumentTheme, header: boolean): Style {
  return {
    flex: 1,
    fontSize: theme.type.caption,
    padding: 4,
    borderBottomWidth: 0.4,
    borderBottomColor: theme.colors.border,
    fontFamily: header ? "Helvetica-Bold" : "Helvetica",
    color: header ? theme.colors.primary : theme.colors.text,
  };
}

function PdfDiagram({ node, theme }: { node: Block; theme: DocumentTheme }) {
  const diagram = diagramOf(node);
  if (diagram.nodes.length === 0) {
    return <Text style={{ color: theme.colors.danger }}>Diagram {node.id} requires at least one node.</Text>;
  }
  const layout = layoutDiagram(node);
  return (
    <View style={{ marginBottom: theme.space.md }} wrap={false}>
      <Svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`}>
        {layout.edges.map((edge, index) => (
          <Line key={`e-${index}`} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke={theme.colors.primary} strokeWidth={1.2} />
        ))}
        {layout.boxes.map((box) => (
          <Fragment key={box.id}>
            <Rect x={box.x} y={box.y} width={box.w} height={box.h} rx={6} fill={theme.colors.accent} stroke={theme.colors.primary} strokeWidth={1} />
            {diagram.layout === "hub" && box.hub ? <Circle cx={box.x + box.w / 2} cy={box.y + 10} r={3} fill={theme.colors.primary} /> : null}
            <Text x={box.x + 6} y={box.y + (box.hub ? 22 : 16)} style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>{box.label}</Text>
            {box.caption ? <Text x={box.x + 6} y={box.y + (box.hub ? 34 : 28)} style={{ fontSize: 8 }} fill={theme.colors.muted}>{box.caption}</Text> : null}
            {box.fields.map((field, fieldIndex) => (
              <Text key={field} x={box.x + 6} y={box.y + 40 + fieldIndex * 10} style={{ fontSize: 8 }}>{field}</Text>
            ))}
          </Fragment>
        ))}
      </Svg>
    </View>
  );
}

