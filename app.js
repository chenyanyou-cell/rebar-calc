const REBAR_CODE_TO_DIAMETER_MM = {
  3: 10,
  4: 13,
  5: 16,
  6: 19,
  7: 22,
  8: 25,
  9: 29,
  10: 32,
};

const REBAR_UNIT_WEIGHT = {
  10: 0.561,
  13: 0.996,
  16: 1.556,
  19: 2.24,
  22: 3.049,
  25: 3.982,
  29: 5.071,
  32: 6.418,
};

function normalizeMark(mark) {
  return String(mark ?? "")
    .trim()
    .toUpperCase()
    .replaceAll("＃", "#")
    .replaceAll("＠", "@")
    .replaceAll("－", "-")
    .replaceAll("—", "-")
    .replaceAll("×", "X")
    .replaceAll("*", "X")
    .replace(/\s+/g, " ");
}

function toPositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${label}必須大於 0`);
  }
  return number;
}

function toPositiveInteger(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`${label}必須為正整數`);
  }
  return number;
}

function getDiameterFromCode(code) {
  const diameterMm = REBAR_CODE_TO_DIAMETER_MM[code];
  if (!diameterMm) {
    throw new Error(`鋼筋號數必須為 3-10，目前輸入：${code}`);
  }
  return diameterMm;
}

function getCodeFromDiameter(diameterMm) {
  const entry = Object.entries(REBAR_CODE_TO_DIAMETER_MM).find(
    ([, mappedDiameter]) => mappedDiameter === diameterMm,
  );
  if (!entry) {
    throw new Error(`不支援 D${diameterMm}，請輸入 D10/D13/D16/D19/D22/D25/D29/D32`);
  }
  return Number(entry[0]);
}

function getUnitWeight(diameterMm) {
  const unitWeight = REBAR_UNIT_WEIGHT[diameterMm];
  if (!unitWeight) {
    throw new Error(`沒有 D${diameterMm} 的單位重量資料`);
  }
  return unitWeight;
}

export function parseMainRebarMark(mark) {
  const text = normalizeMark(mark);
  const patterns = [
    /^(?<quantity>\d+)\s*-?\s*D(?<diameter>\d+)$/,
    /^D(?<diameter>\d+)\s*X\s*(?<quantity>\d+)$/,
    /^#(?<code>10|[3-9])(?:\s+|X|-)?(?<quantity>\d+)\D*$/,
    /^(?<quantity>\d+)(?:支)?\s*#(?<code>\d+)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const quantity = toPositiveInteger(match.groups.quantity, "主筋支數");
    if (match.groups.code) {
      const code = Number(match.groups.code);
      return {
        code,
        diameterMm: getDiameterFromCode(code),
        quantity,
        source: mark,
      };
    }

    const diameterMm = Number(match.groups.diameter);
    return {
      code: getCodeFromDiameter(diameterMm),
      diameterMm,
      quantity,
      source: mark,
    };
  }

  throw new Error("主筋標示無法解析，例：16-D16、D16x16、#5 16支、#516");
}

export function parseStirrupMark(mark) {
  const text = normalizeMark(mark).replaceAll(" ", "").replace("CM", "");
  const patterns = [
    /^D(?<diameter>\d+)@(?<spacing>\d+(?:\.\d+)?)$/,
    /^#(?<code>\d+)@(?<spacing>\d+(?:\.\d+)?)$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const spacingCm = toPositiveNumber(match.groups.spacing, "箍筋間距");
    if (match.groups.code) {
      const code = Number(match.groups.code);
      return {
        code,
        diameterMm: getDiameterFromCode(code),
        spacingCm,
        source: mark,
      };
    }

    const diameterMm = Number(match.groups.diameter);
    return {
      code: getCodeFromDiameter(diameterMm),
      diameterMm,
      spacingCm,
      source: mark,
    };
  }

  throw new Error("箍筋標示無法解析，例：D10@20、#3@20cm");
}

function calculateCageDiameter(pileDiameterCm) {
  const diameter = toPositiveNumber(pileDiameterCm, "樁徑");
  const coverCm = diameter <= 40 ? 5 : 7.5;
  const cageDiameterCm = diameter - coverCm * 2;
  if (cageDiameterCm <= 0) {
    throw new Error("樁徑過小，扣除保護層後籠徑小於或等於 0");
  }
  return { coverCm, cageDiameterCm };
}

function calculateEffectiveLength(data) {
  if (!data.hasOverlap) {
    return toPositiveNumber(data.cageLengthM, "鋼筋籠長度");
  }

  const section1M = toPositiveNumber(data.section1M, "第一段長度");
  const section2M = toPositiveNumber(data.section2M, "第二段長度");
  const lapM = toPositiveNumber(data.lapM, "搭接長度");
  if (section1M + section2M <= lapM) {
    throw new Error("搭接長度不可大於或等於兩段總長度");
  }
  return section1M + section2M - lapM;
}

function calculateSegments(data, effectiveLengthM, defaultSpacingCm) {
  if (!data.useMultiSpacing) {
    return [{ spacingCm: defaultSpacingCm, lengthM: effectiveLengthM }];
  }

  const segments = [
    {
      spacingCm: toPositiveNumber(data.topSpacingCm, "上段間距"),
      lengthM: toPositiveNumber(data.topLengthM, "上段長度"),
    },
    {
      spacingCm: toPositiveNumber(data.middleSpacingCm, "中段間距"),
      lengthM: toPositiveNumber(data.middleLengthM, "中段長度"),
    },
    {
      spacingCm: toPositiveNumber(data.bottomSpacingCm, "下段間距"),
      lengthM: toPositiveNumber(data.bottomLengthM, "下段長度"),
    },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.lengthM, 0);
  if (Math.abs(total - effectiveLengthM) > 0.01) {
    throw new Error(`分段長度合計 ${total.toFixed(2)}m，需等於有效籠長 ${effectiveLengthM.toFixed(2)}m`);
  }
  return segments;
}

export function calculateRebarCage(data) {
  const projectName = String(data.projectName ?? "").trim();
  const cageCount = toPositiveInteger(data.cageCount, "鋼筋籠數量");
  const { coverCm, cageDiameterCm } = calculateCageDiameter(data.pileDiameterCm);
  const effectiveLengthM = calculateEffectiveLength(data);
  const main = parseMainRebarMark(data.mainMark);
  const stirrup = parseStirrupMark(data.stirrupMark);
  const stirrupBarLengthM = toPositiveNumber(data.stirrupBarLengthM, "箍筋料長");
  const segments = calculateSegments(data, effectiveLengthM, stirrup.spacingCm);

  const mainSingleWeightKg =
    effectiveLengthM * main.quantity * getUnitWeight(main.diameterMm);
  const mainTotalWeightKg = mainSingleWeightKg * cageCount;
  const cageCenterCm = cageDiameterCm - stirrup.diameterMm / 10;
  if (cageCenterCm <= 0) {
    throw new Error("籠徑與箍筋直徑組合不合理");
  }

  const singleCircleM = Math.PI * cageCenterCm / 100;
  const totalCirclesPerCage = segments.reduce(
    (sum, segment) => sum + Math.ceil(segment.lengthM / (segment.spacingCm / 100)),
    0,
  );
  const adjustedBarLengthM = Math.max(stirrupBarLengthM, singleCircleM);
  const circlesPerBar = Math.max(1, Math.floor(adjustedBarLengthM / singleCircleM));
  const barsNeededPerCage = Math.ceil(totalCirclesPerCage / circlesPerBar);
  const stirrupTotalLengthPerCageM = totalCirclesPerCage * singleCircleM;
  const stirrupSingleWeightKg =
    stirrupTotalLengthPerCageM * getUnitWeight(stirrup.diameterMm);
  const stirrupTotalWeightKg = stirrupSingleWeightKg * cageCount;

  return {
    projectName,
    coverCm,
    cageDiameterCm,
    effectiveLengthM,
    cageCount,
    main: {
      ...main,
      totalQuantity: main.quantity * cageCount,
      singleWeightKg: mainSingleWeightKg,
      totalWeightKg: mainTotalWeightKg,
    },
    stirrup: {
      ...stirrup,
      cageCenterCm,
      singleCircleM,
      totalCirclesPerCage,
      totalLengthPerCageM: stirrupTotalLengthPerCageM,
      circlesPerBar,
      barsNeededPerCage,
      totalBarsNeeded: barsNeededPerCage * cageCount,
      singleWeightKg: stirrupSingleWeightKg,
      totalWeightKg: stirrupTotalWeightKg,
      adjustedBarLengthM,
      segments,
    },
    singleCageWeightKg: mainSingleWeightKg + stirrupSingleWeightKg,
    totalWeightKg: mainTotalWeightKg + stirrupTotalWeightKg,
  };
}

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString("zh-TW", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getFormData(form) {
  const formData = new FormData(form);
  const data = Object.fromEntries(formData.entries());
  data.hasOverlap = formData.get("hasOverlap") === "on";
  data.useMultiSpacing = formData.get("useMultiSpacing") === "on";
  return data;
}

function renderResult(result) {
  return `
    <section class="result-hero">
      <div>
        <span>總重量</span>
        <strong>${formatNumber(result.totalWeightKg)} kg</strong>
      </div>
      <div>
        <span>單支籠</span>
        <strong>${formatNumber(result.singleCageWeightKg)} kg</strong>
      </div>
    </section>

    <section class="summary-grid">
      <div><span>案名/構件</span><strong>${result.projectName || "未填"}</strong></div>
      <div><span>鋼筋籠數量</span><strong>${result.cageCount} 支</strong></div>
      <div><span>有效籠長</span><strong>${formatNumber(result.effectiveLengthM)} m</strong></div>
      <div><span>籠徑</span><strong>${formatNumber(result.cageDiameterCm, 1)} cm</strong></div>
    </section>

    <section class="result-section">
      <h2>主筋</h2>
      <dl>
        <div><dt>圖面輸入</dt><dd>${result.main.source}</dd></div>
        <div><dt>規格</dt><dd>${result.main.code} 號 (${result.main.diameterMm} mm)</dd></div>
        <div><dt>總支數</dt><dd>${result.main.totalQuantity} 支</dd></div>
        <div><dt>總重量</dt><dd>${formatNumber(result.main.totalWeightKg)} kg</dd></div>
      </dl>
    </section>

    <section class="result-section">
      <h2>箍筋</h2>
      <dl>
        <div><dt>圖面輸入</dt><dd>${result.stirrup.source}</dd></div>
        <div><dt>規格</dt><dd>${result.stirrup.code} 號 (${result.stirrup.diameterMm} mm)</dd></div>
        <div><dt>單圈長度</dt><dd>${formatNumber(result.stirrup.singleCircleM)} m</dd></div>
        <div><dt>單支籠圈數</dt><dd>${result.stirrup.totalCirclesPerCage} 圈</dd></div>
        <div><dt>全部約需料</dt><dd>${result.stirrup.totalBarsNeeded} 支</dd></div>
        <div><dt>總重量</dt><dd>${formatNumber(result.stirrup.totalWeightKg)} kg</dd></div>
      </dl>
    </section>
  `;
}

function bindUi() {
  const form = document.querySelector("#rebar-form");
  if (!form) return;

  const overlapFields = document.querySelector("#overlap-fields");
  const straightLengthField = document.querySelector("#straight-length-field");
  const multiFields = document.querySelector("#multi-spacing-fields");
  const resultPanel = document.querySelector("#result-panel");
  const errorPanel = document.querySelector("#error-panel");

  function syncVisibility() {
    const hasOverlap = form.elements.hasOverlap.checked;
    const useMultiSpacing = form.elements.useMultiSpacing.checked;
    overlapFields.hidden = !hasOverlap;
    straightLengthField.hidden = hasOverlap;
    multiFields.hidden = !useMultiSpacing;
  }

  form.addEventListener("change", syncVisibility);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    errorPanel.hidden = true;
    try {
      const result = calculateRebarCage(getFormData(form));
      resultPanel.innerHTML = renderResult(result);
      resultPanel.hidden = false;
      resultPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      resultPanel.hidden = true;
      errorPanel.textContent = error.message;
      errorPanel.hidden = false;
    }
  });

  form.addEventListener("reset", () => {
    window.setTimeout(() => {
      syncVisibility();
      resultPanel.hidden = true;
      errorPanel.hidden = true;
    }, 0);
  });

  syncVisibility();
}

if (typeof document !== "undefined") {
  bindUi();
}
