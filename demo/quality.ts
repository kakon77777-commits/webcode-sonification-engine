import { renderInstrumentCatalog, type VoiceRenderResult } from "../src/audio/quality-render.js";

const runButton = document.getElementById("run") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;
const resultsEl = document.getElementById("results") as HTMLTableSectionElement;

function metric(value: number): string {
  return value.toFixed(6);
}

function appendCell(row: HTMLTableRowElement, text: string, className = ""): void {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  row.appendChild(cell);
}

function renderResult(result: VoiceRenderResult): void {
  const row = document.createElement("tr");
  const status = result.healthy ? "PASS" : "FAIL";
  appendCell(row, result.instrument);
  appendCell(row, metric(result.metrics.peak));
  appendCell(row, metric(result.metrics.rms));
  appendCell(row, String(result.metrics.clippedSamples));
  appendCell(row, String(result.metrics.nonFiniteSamples));
  appendCell(row, status, result.healthy ? "pass" : "fail");
  resultsEl.appendChild(row);
}

async function runQualityRender(): Promise<void> {
  runButton.disabled = true;
  resultsEl.textContent = "";
  statusEl.textContent = "Rendering catalog...";

  try {
    const results = await renderInstrumentCatalog();
    for (const result of results) renderResult(result);

    const failed = results.filter((result) => !result.healthy);
    const summary = failed.length === 0 ? "PASS" : "FAIL";
    statusEl.textContent =
      `${summary}: ${results.length} instruments rendered, ${failed.length} failed quality checks.`;
    statusEl.className = failed.length === 0 ? "pass" : "fail";
    (window as unknown as { __wseQuality?: VoiceRenderResult[] }).__wseQuality = results;
  } catch (error) {
    statusEl.textContent = error instanceof Error ? `FAIL: ${error.message}` : "FAIL: unknown error";
    statusEl.className = "fail";
    console.error(error);
  } finally {
    runButton.disabled = false;
  }
}

runButton.addEventListener("click", () => {
  void runQualityRender();
});
