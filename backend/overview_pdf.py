"""PDF rendering of the overall analytics report (report_service.build_overview)."""

from __future__ import annotations

from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND = colors.HexColor("#047857")
BRAND_SOFT = colors.HexColor("#ecfdf5")
INK = colors.HexColor("#0f1a16")
MUTED = colors.HexColor("#52625b")
LINE = colors.HexColor("#d5ddd9")
ZEBRA = colors.HexColor("#f6f8f7")
WARN = colors.HexColor("#b45309")
DANGER = colors.HexColor("#b91c1c")
WATER = colors.HexColor("#0369a1")
WIDTH = 182 * mm

_ss = getSampleStyleSheet()
H1 = ParagraphStyle("h1", parent=_ss["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=INK, alignment=0, spaceAfter=2)
H2 = ParagraphStyle("h2", parent=_ss["Heading2"], fontName="Helvetica-Bold", fontSize=12.5, leading=16, textColor=BRAND, spaceBefore=10, spaceAfter=5)
BODY = ParagraphStyle("body", parent=_ss["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=INK)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=7.5, leading=10, textColor=MUTED)
KPI_V = ParagraphStyle("kpiv", parent=BODY, fontName="Helvetica-Bold", fontSize=11.5, leading=14)
KPI_L = ParagraphStyle("kpil", parent=SMALL, fontName="Helvetica-Bold", fontSize=6.8, textColor=MUTED)


def _fmt(v, d=0, unit=""):
    if v is None:
        return "—"
    try:
        s = f"{float(v):,.{d}f}"
    except (TypeError, ValueError):
        return escape(str(v))
    return f"{s} {unit}".strip()


def _date(iso: str) -> str:
    try:
        return datetime.fromisoformat(iso).strftime("%d %b %Y")
    except Exception:
        return iso


def _kpis(items):
    cells = [[Paragraph(escape(label.upper()), KPI_L), Paragraph(value, KPI_V)] for label, value in items]
    row = [Table([[c[0]], [c[1]]], colWidths=[WIDTH / len(items) - 4]) for c in cells]
    t = Table([row], colWidths=[WIDTH / len(items)] * len(items))
    t.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.4, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def _table(header, rows, widths, status_col=None):
    data = [header] + rows
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), BRAND), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ZEBRA]), ("LINEBELOW", (0, 0), (-1, -1), 0.3, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 3.5), ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    if status_col is not None:
        for i, r in enumerate(rows, start=1):
            ok = str(r[status_col]).lower() in ("compliant", "normal", "ok")
            style.append(("TEXTCOLOR", (status_col, i), (status_col, i), BRAND if ok else WARN))
            style.append(("FONTNAME", (status_col, i), (status_col, i), "Helvetica-Bold"))
    t.setStyle(TableStyle(style))
    return t


def _bar_chart(labels, values, title, color=BRAND, horizontal=False, height=150):
    d = Drawing(WIDTH, height)
    chart = HorizontalBarChart() if horizontal else VerticalBarChart()
    chart.x, chart.y = (90, 15) if horizontal else (40, 30)
    chart.width = WIDTH - chart.x - 15
    chart.height = height - chart.y - 22
    chart.data = [values or [0]]
    chart.bars[0].fillColor = color
    chart.bars[0].strokeColor = None
    chart.valueAxis.valueMin = 0
    chart.valueAxis.labels.fontSize = 6.5
    chart.valueAxis.labelTextFormat = lambda v: f"{v / 1e6:,.1f}M" if v >= 1e6 else f"{v / 1e3:,.0f}k" if v >= 1e4 else f"{v:,.0f}"
    chart.valueAxis.labels.fillColor = MUTED
    chart.valueAxis.strokeColor = LINE
    chart.valueAxis.gridStrokeColor = LINE
    chart.valueAxis.visibleGrid = True
    chart.categoryAxis.categoryNames = labels or [""]
    chart.categoryAxis.labels.fontSize = 6.5
    chart.categoryAxis.labels.fillColor = MUTED
    chart.categoryAxis.strokeColor = LINE
    if not horizontal and len(labels) > 12:
        chart.categoryAxis.labels.angle = 45
        chart.categoryAxis.labels.boxAnchor = "ne"
    d.add(chart)
    d.add(String(0, height - 10, title, fontName="Helvetica-Bold", fontSize=8.5, fillColor=INK))
    return d


def _unavailable(section):
    return Paragraph("<font color='#b45309'><b>No data available for this period.</b></font> The data source did not respond when the report was generated.", SMALL)


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(14 * mm, 8 * mm, "GoGreen · Overall sustainability report · The Light City Penang")
    canvas.drawRightString(A4[0] - 14 * mm, 8 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(BRAND)
    canvas.setLineWidth(2)
    canvas.line(0, A4[1] - 1, A4[0], A4[1] - 1)
    canvas.restoreState()


def build_overview_pdf(r: dict) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, title="GoGreen overall sustainability report", author="GoGreen",
                            leftMargin=14 * mm, rightMargin=14 * mm, topMargin=14 * mm, bottomMargin=16 * mm)
    s = []
    p = r["period"]
    s.append(Paragraph("Overall sustainability report", H1))
    s.append(Paragraph(f"{escape(r['facility'])} · {_date(p['start'])} – {_date(p['end'])} · generated {_date(r['generated_at'])}", SMALL))
    s.append(Spacer(1, 8))

    e, i, w, ws, al, sv = (r[k] for k in ("energy", "indoor", "water", "waste", "alarms", "savings"))
    s.append(_kpis([
        ("Energy", _fmt(e.get("total_kwh"), 0, "kWh") if e.get("available") else "—"),
        ("Carbon", _fmt((e.get("carbon_kg") or 0) / 1000, 1, "t CO2e") if e.get("available") else "—"),
        ("Energy cost", f"RM {_fmt(e.get('total_cost_myr'))}" if e.get("available") else "—"),
        ("IEQ compliant", f"{i['compliant_floors']}/{i['total_floors']} floors" if i.get("available") else "—"),
        ("Open alarms", _fmt(al.get("open")) if al.get("available") else "—"),
    ]))

    # Executive summary
    ai = r.get("ai_summary") or {}
    s.append(Paragraph("Executive summary", H2))
    box = [Paragraph(escape(ai.get("summary") or " ".join(r.get("highlights", []))), BODY)]
    if ai.get("actions"):
        box.append(Spacer(1, 4))
        box.append(Paragraph("<b>Recommended actions</b>", BODY))
        box += [Paragraph(f"{n}. {escape(a)}", BODY) for n, a in enumerate(ai["actions"], start=1)]
    src = {"azure": "Azure OpenAI", "gemini": "Gemini", "openai": "OpenAI"}.get(ai.get("source"), "rule-based summary")
    box.append(Spacer(1, 3))
    box.append(Paragraph(f"Written by {src} from the figures in this report.", SMALL))
    t = Table([[box]], colWidths=[WIDTH])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), BRAND_SOFT), ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#a7f3d0")), ("PADDING", (0, 0), (-1, -1), 8)]))
    s.append(t)

    # Digital Twin closed-loop evidence. Monthly and yearly are the executive
    # views; daily rows remain available as operational traceability.
    evidence = r.get("scenario_evidence") or {}
    if evidence.get("available"):
        s.append(Paragraph("Resolved incident evidence", H2))
        s.append(Paragraph(
            f"{evidence.get('total_incidents', 0)} Digital Twin intervention(s) resolved in this reporting period; "
            f"RM {_fmt(evidence.get('total_avoided_value_myr'))} avoided value, "
            f"{_fmt(evidence.get('total_energy_saved_kwh'), 1)} kWh saved and "
            f"{_fmt(evidence.get('total_carbon_avoided_kg'), 1)} kg CO2e avoided.", BODY
        ))
        for title, key in (("Monthly executive roll-up", "monthly"), ("Yearly portfolio roll-up", "yearly")):
            rows = [[row["period"], row["incidents"], _fmt(row["avoided_value_myr"], 2), _fmt(row["energy_saved_kwh"], 1), _fmt(row["carbon_avoided_kg"], 1)] for row in evidence.get(key, [])]
            if rows:
                s.append(Spacer(1, 4))
                s.append(Paragraph(title, SMALL))
                s.append(_table(["Period", "Incidents", "Avoided RM", "Energy kWh", "CO2e kg"], rows, [35 * mm, 25 * mm, 32 * mm, 32 * mm, 32 * mm]))

    audit = r.get("intervention_audit") or {}
    s.append(Paragraph("Operational Intervention Audit Trail", H2))
    s.append(Paragraph(
        "Detailed timestamp, protocol, command and verification records for autonomous control interventions.", BODY
    ))
    if audit.get("available"):
        audit_rows = []
        for row in audit.get("rows", []):
            action = escape(str(row.get("action", "")))
            root = escape(str(row.get("root_cause", "")))
            audit_rows.append([
                Paragraph(escape(str(row.get("timestamp", ""))[:19].replace("T", " ")), SMALL),
                Paragraph(escape(str(row.get("system", ""))), SMALL),
                Paragraph(escape(str(row.get("protocol", ""))), SMALL),
                Paragraph(f"{action}<br/><font color='#52625b'>Root: {root}</font>", SMALL),
                Paragraph(f"RM {_fmt(row.get('cost_impact_myr'), 2)}", SMALL),
                Paragraph(escape(str(row.get("status", ""))), SMALL),
            ])
        s.append(_table(
            ["Timestamp", "System", "Protocol", "Action / Root Cause", "Impact", "Status"],
            audit_rows,
            [29 * mm, 20 * mm, 23 * mm, 66 * mm, 24 * mm, 20 * mm],
        ))
    else:
        s.append(Paragraph("No operational intervention records were available for this period.", SMALL))

    # Energy
    s.append(Paragraph("1. Energy and carbon", H2))
    if e.get("available"):
        s.append(Paragraph(f"Building EEI {_fmt(e['building_eei'], 1)} kWh/m²·yr ({escape(str(e['compliance_status']))}); peak demand {_fmt(e.get('peak_demand_kw'), 0, 'kW')}; grid factor 0.585 kg CO2e/kWh.", BODY))
        s.append(Spacer(1, 4))
        if e["daily"]:
            s.append(_bar_chart([d["date"][5:] for d in e["daily"]], [d["kwh"] for d in e["daily"]], "Daily electricity (kWh)"))
        rows = [[Paragraph(escape(z["name"]), SMALL), z["floors"], _fmt(z["kwh"]), _fmt(z["eei"], 1), _fmt(z["baseline_eei"]), f"RM {_fmt(z['cost_myr'])}", z["status"]] for z in e["zones"]]
        s.append(_table(["Zone", "Floors", "kWh", "EEI", "Baseline", "Cost", "Status"], rows,
                        [42 * mm, 22 * mm, 26 * mm, 22 * mm, 20 * mm, 28 * mm, 22 * mm], status_col=6))
    else:
        s.append(_unavailable(e))

    # Indoor
    block = [Paragraph("2. Indoor environmental quality (GreenRE EQ-3)", H2)]
    if i.get("available"):
        block.append(Paragraph(f"Snapshot at {escape(str(i.get('snapshot_at', ''))[:16].replace('T', ' '))} UTC. Average CO2 {_fmt(i['avg_co2'])} ppm, peak {_fmt(i['max_co2'])} ppm (limit {_fmt(i['threshold_ppm'])} ppm); average PM2.5 {_fmt(i['avg_pm25'], 1)} µg/m³.", BODY))
        block.append(Spacer(1, 4))
        block.append(_bar_chart([f["floor"] for f in i["floors"]], [f["co2"] for f in i["floors"]], "CO2 by floor (ppm)", height=130))
        block.append(_table(["Floor", "Space", "CO2 (ppm)", "PM2.5", "Status"],
                            [[f["floor"], f["name"], _fmt(f["co2"]), _fmt(f["pm25"], 1), f["status"]] for f in i["floors"]],
                            [18 * mm, 80 * mm, 30 * mm, 26 * mm, 28 * mm], status_col=4))
    else:
        block.append(_unavailable(i))
    s.append(KeepTogether(block))

    # Water
    block = [Paragraph("3. Water", H2)]
    if w.get("available"):
        block.append(Paragraph(f"{_fmt(w['active_meters'])} smart meters live; building register {_fmt(w['register_m3'], 1)} m³; current flow {_fmt(w['flow_m3_per_hr'], 2)} m³/h.", BODY))
        dist = w.get("distribution_24h") or []
        if dist:
            labels = [str(x.get("water_category") or x.get("meter_type") or "").replace("_", " ").title() for x in dist]
            vals = [float(x.get("volume_m3") or x.get("value") or 0) for x in dist]
            block.append(_bar_chart(labels, vals, "Volume by sub-system, last 24 h (m³)", color=WATER, horizontal=True, height=120))
    else:
        block.append(_unavailable(w))
    s.append(KeepTogether(block))

    # Waste
    block = [Paragraph("4. Waste", H2)]
    if ws.get("available"):
        block.append(_kpis([
            ("Site", escape(ws["site"])), ("Total waste", _fmt(ws["total_kg"], 1, "kg")),
            ("Recycling", f"{_fmt(ws['recycling_rate'], 1)}%"), ("Contamination", f"{_fmt(ws['contamination_rate'], 1)}%"),
            ("CO2e avoided", _fmt(ws["co2e_avoided_kg"], 1, "kg")),
        ]))
        if not ws["items"]:
            block.append(Paragraph("No waste scans were recorded in this period.", SMALL))
    else:
        block.append(_unavailable(ws))
    s.append(KeepTogether(block))

    # Alarms
    block = [Paragraph("5. Alarms", H2)]
    if al.get("available"):
        sev = ", ".join(f"{k}: {v}" for k, v in al["by_severity"].items()) or "none"
        block.append(Paragraph(f"{al['total']} alarms raised ({escape(sev)}); {al['open']} still open.", BODY))
        if al["recent"]:
            block.append(Spacer(1, 4))
            block.append(_table(["Raised", "Code", "Severity", "State", "Description"],
                                [[a["at"][:16].replace("T", " "), a["code"], a["severity"], a["state"].split(".")[-1], Paragraph(escape(a["description"]), SMALL)] for a in al["recent"]],
                                [26 * mm, 36 * mm, 18 * mm, 18 * mm, 84 * mm]))
    else:
        block.append(_unavailable(al))
    s.append(KeepTogether(block))

    # Savings
    if sv.get("available"):
        s.append(KeepTogether([
            Paragraph("6. Savings from automated controls", H2),
            Paragraph("Monthly results of the controlled sustainability experiment (simulated, ASHRAE 90.1-2022 baseline). These are not measurements for this reporting period.", SMALL),
            Spacer(1, 4),
            _kpis([
                ("CO2e avoided", _fmt((sv["co2e_saved_kg"] or 0) / 1000, 1, "t")), ("Energy saved", _fmt(sv["energy_saved_kwh"], 0, "kWh")),
                ("Cost saved", f"RM {_fmt(sv['cost_saved_myr'])}"), ("GreenRE EEI", f"{_fmt(sv['eei_before'], 1)} → {_fmt(sv['eei_after'], 1)}"),
            ]),
        ]))

    doc.build(s, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
