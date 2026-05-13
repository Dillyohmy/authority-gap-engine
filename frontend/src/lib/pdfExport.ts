import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { IS_MOCK_MODE } from "./mockScanData";

/**
 * Authority Gap Engine™ — Premium PDF Export
 *
 * Captures the report DOM at high resolution, slices into A4 pages
 * with proper margins, branded footer, and PNG output for crisp text.
 */
export async function exportReportPdf(
  element: HTMLElement,
  filename = "authority-gap-report.pdf"
): Promise<void> {
  const A4_W = 595.28; // pt
  const A4_H = 841.89;
  const MARGIN_X = 28;
  const MARGIN_TOP = 28;
  const MARGIN_BOTTOM = 36; // room for footer
  const CONTENT_W = A4_W - MARGIN_X * 2;
  const PAGE_H = A4_H - MARGIN_TOP - MARGIN_BOTTOM;

  // Force a fixed render width so the capture is consistent regardless of viewport
  const RENDER_WIDTH = 820;

  // Temporarily expand element to full width for capture
  const origWidth = element.style.width;
  const origMaxWidth = element.style.maxWidth;
  const origOverflow = element.style.overflow;
  element.style.width = `${RENDER_WIDTH}px`;
  element.style.maxWidth = `${RENDER_WIDTH}px`;
  element.style.overflow = "visible";

  try {
    const canvas = await html2canvas(element, {
      scale: 2.5,                 // higher DPI for crisp text
      useCORS: true,
      logging: false,
      backgroundColor: "#F4F6F3", // IHD secondary bg
      windowWidth: RENDER_WIDTH,
      imageTimeout: 15000,
      removeContainer: true,
    });

    // Restore original styles
    element.style.width = origWidth;
    element.style.maxWidth = origMaxWidth;
    element.style.overflow = origOverflow;

    const scaleFactor = CONTENT_W / canvas.width;
    const totalImgH = canvas.height * scaleFactor;

    // How many canvas pixels fit per page content area
    const canvasPixelsPerPage = PAGE_H / scaleFactor;

    const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

    let srcY = 0;
    let pageNum = 0;

    while (srcY < canvas.height) {
      if (pageNum > 0) pdf.addPage();

      const sliceH = Math.min(canvasPixelsPerPage, canvas.height - srcY);

      // Slice canvas
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil(sliceH);
      const ctx = pageCanvas.getContext("2d");
      if (ctx) {
        // White fill to avoid transparent edges
        ctx.fillStyle = "#F4F6F3";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0, Math.floor(srcY), canvas.width, Math.ceil(sliceH),
          0, 0, canvas.width, Math.ceil(sliceH)
        );
      }

      // Use PNG for crisp text rendering (larger file but much sharper)
      const imgData = pageCanvas.toDataURL("image/png");
      const renderH = sliceH * scaleFactor;

      pdf.addImage(imgData, "PNG", MARGIN_X, MARGIN_TOP, CONTENT_W, renderH);

      // Branded footer line
      pdf.setDrawColor(200);
      pdf.setLineWidth(0.5);
      pdf.line(MARGIN_X, A4_H - 24, A4_W - MARGIN_X, A4_H - 24);

      pdf.setFontSize(6.5);
      pdf.setTextColor(140);
      pdf.text(
        "Authority Gap Engine™ by I Have Design",
        MARGIN_X,
        A4_H - 14
      );
      pdf.text(
        `Page ${pageNum + 1}`,
        A4_W - MARGIN_X,
        A4_H - 14,
        { align: "right" }
      );

      // Preview mode disclaimer on every page
      if (IS_MOCK_MODE) {
        pdf.setFontSize(5.5);
        pdf.setTextColor(170);
        pdf.text(
          "This report is generated from a preview diagnostic model. Live analysis will include real search and site data.",
          A4_W / 2,
          A4_H - 6,
          { align: "center" }
        );
      }

      srcY += canvasPixelsPerPage;
      pageNum++;
    }

    pdf.save(filename);
  } catch (err) {
    // Restore styles on error
    element.style.width = origWidth;
    element.style.maxWidth = origMaxWidth;
    element.style.overflow = origOverflow;
    throw err;
  }
}
