// routeform.js — 관심 노선 추가/편집 모달. openRouteForm(prefill) → Promise<config|null>

(function () {
  function openRouteForm(prefill = {}) {
    return new Promise((resolve) => {
      const isEdit = !!prefill.id;
      const bands = DeepLink.TIME_BANDS.map((b) => `<option value="${b.id}">${b.label}</option>`).join("");
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <div class="modal-head">
            <h3>${isEdit ? "관심 노선 편집" : "관심 노선 추가"}</h3>
            <button class="icon-mini modal-close" title="닫기">✕</button>
          </div>
          <div class="modal-body">
            <div class="trip-toggle" id="mfTrip" style="margin-bottom:16px">
              <button data-trip="round">왕복</button><button data-trip="oneway">편도</button>
            </div>
            <div class="mf-grid">
              <div class="field"><label>출발지</label><input id="mfOrigin" autocomplete="off" placeholder="도시·공항코드"></div>
              <div class="field"><label>도착지</label><input id="mfDest" autocomplete="off" placeholder="도시·공항코드"></div>
              <div class="field"><label>가는 날</label><input id="mfDepart" type="date"></div>
              <div class="field" id="mfReturnField"><label>오는 날</label><input id="mfReturn" type="date"></div>
              <div class="field"><label>인원</label><select id="mfPax"></select></div>
              <div class="field"><label>가는 편 시간대</label><select id="mfDepTime">${bands}</select></div>
              <div class="field" id="mfRetTimeField"><label>오는 편 시간대</label><select id="mfRetTime">${bands}</select></div>
              <div class="field"><label>목표가 (원, 1인당)</label><input id="mfTarget" type="number" min="0" step="10000" placeholder="예: 350000"></div>
              <div class="field mf-full"><label>메모 (선택)</label><input id="mfMemo" placeholder="예: 추석 연휴, 목표가 도달 시 예매"></div>
              <label class="checkbox mf-full" style="margin-top:2px"><input type="checkbox" id="mfDirect"> 직항만</label>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost modal-close">취소</button>
            <button class="btn btn-primary" id="mfSave">${isEdit ? "저장" : "추가"}</button>
          </div>
        </div>`;
      document.body.append(overlay);
      document.body.style.overflow = "hidden";
      const $ = (id) => overlay.querySelector("#" + id);

      $("mfPax").innerHTML = [1, 2, 3, 4].map((n) => `<option value="${n}">성인 ${n}명</option>`).join("");
      attachAutocomplete($("mfOrigin"));
      attachAutocomplete($("mfDest"));

      let trip = prefill.tripType || "round";
      const syncTrip = () => {
        overlay.querySelectorAll("#mfTrip button").forEach((b) => b.classList.toggle("active", b.dataset.trip === trip));
        $("mfReturnField").style.display = trip === "oneway" ? "none" : "";
        $("mfRetTimeField").style.display = trip === "oneway" ? "none" : "";
      };
      overlay.querySelector("#mfTrip").addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (b) { trip = b.dataset.trip; syncTrip(); }
      });

      // prefill
      if (prefill.origin) { $("mfOrigin").value = airportLabel(prefill.origin); $("mfOrigin").dataset.code = prefill.origin; }
      if (prefill.destination) { $("mfDest").value = airportLabel(prefill.destination); $("mfDest").dataset.code = prefill.destination; }
      $("mfDepart").value = prefill.departDate || "";
      $("mfReturn").value = prefill.returnDate || "";
      $("mfPax").value = prefill.passengers || 1;
      $("mfDirect").checked = !!prefill.direct;
      $("mfDepTime").value = prefill.departTime || "any";
      $("mfRetTime").value = prefill.returnTime || "any";
      if (prefill.targetPrice != null) $("mfTarget").value = prefill.targetPrice;
      $("mfMemo").value = prefill.memo || "";
      const todayStr = new Date().toISOString().slice(0, 10);
      $("mfDepart").min = todayStr; $("mfReturn").min = todayStr;
      syncTrip();

      const close = (val) => { overlay.remove(); document.body.style.overflow = ""; resolve(val); };
      overlay.querySelectorAll(".modal-close").forEach((b) => b.addEventListener("click", () => close(null)));
      overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(null); });

      $("mfSave").addEventListener("click", () => {
        const o = ($("mfOrigin").dataset.code || $("mfOrigin").value.trim().toUpperCase()).slice(0, 3);
        const d = ($("mfDest").dataset.code || $("mfDest").value.trim().toUpperCase()).slice(0, 3);
        if (!o || !d) return toast("출발지·도착지를 입력하세요");
        if (o === d) return toast("출발지와 도착지가 같습니다");
        if (!$("mfDepart").value) return toast("가는 날을 선택하세요");
        if (trip === "round" && !$("mfReturn").value) return toast("오는 날을 선택하세요");

        const cfg = {
          id: prefill.id || `local-${o}-${d}-${$("mfDepart").value}-${Math.floor(Math.random() * 10000)}`,
          name: `${airportCity(o)} → ${airportCity(d)}`,
          origin: o, destination: d,
          departDate: $("mfDepart").value,
          returnDate: trip === "round" ? $("mfReturn").value : undefined,
          tripType: trip,
          passengers: Number($("mfPax").value),
          direct: $("mfDirect").checked,
          departTime: $("mfDepTime").value,
          returnTime: $("mfRetTime").value,
          targetPrice: $("mfTarget").value ? Number($("mfTarget").value) : null,
          currency: "KRW",
          active: true,
          memo: $("mfMemo").value.trim(),
          _local: true,
        };
        close(cfg);
      });
    });
  }
  window.openRouteForm = openRouteForm;
})();
