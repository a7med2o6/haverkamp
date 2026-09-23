/*
  حساب المسافات وتبديل المسار بين محطات الغسيل.

  المسافات المحسوبة هنا هي مسافات خط مستقيم (Straight-line / Haversine) وليس
  مسافة الطرق الفعلية. هذا كافٍ جداً لترتيب محطات الغسيل داخل المنطقة/الحي
  الواحد، ودون الحاجة لاتصال بشبكة أو استهلاك تكلفة وخوادم خرائط خارجية.
*/

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371; // نصف قطر الأرض بالكيلومترات
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export function orderStops<T extends { lat: number | null; lng: number | null }>(
  stops: T[],
  start?: { lat: number; lng: number } | null
): { ordered: T[]; legsKm: Array<number | null> } {
  if (!stops || stops.length === 0) {
    return { ordered: [], legsKm: [] };
  }

  // فصل المحطات ذات الإحداثيات عن المحطات التي بلا إحداثيات مع الاحتفاظ بالترتيب الأصلي
  const locatedWithIdx: Array<{ item: T; origIdx: number; lat: number; lng: number }> = [];
  const unlocated: T[] = [];

  stops.forEach((stop, i) => {
    if (
      stop.lat !== null &&
      stop.lng !== null &&
      Number.isFinite(stop.lat) &&
      Number.isFinite(stop.lng)
    ) {
      locatedWithIdx.push({
        item: stop,
        origIdx: i,
        lat: stop.lat,
        lng: stop.lng,
      });
    } else {
      unlocated.push(stop);
    }
  });

  const N = locatedWithIdx.length;

  if (N === 0) {
    return {
      ordered: [...unlocated],
      legsKm: unlocated.map(() => null),
    };
  }

  // مصفوفة المسافات المسبقة الحساب N x N للسرعة العالية (تُحسب distanceKm مرة واحدة فقط هنا)
  const distMatrix = new Float64Array(N * N);
  for (let i = 0; i < N; i++) {
    const ptI = locatedWithIdx[i];
    for (let j = i + 1; j < N; j++) {
      const d = distanceKm(ptI, locatedWithIdx[j]);
      distMatrix[i * N + j] = d;
      distMatrix[j * N + i] = d;
    }
  }

  // مسافات نقطة البداية إن وُجدت
  let startDist: Float64Array | null = null;
  if (start) {
    startDist = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      startDist[i] = distanceKm(start, locatedWithIdx[i]);
    }
  }

  // دالة الجار الأقرب (Nearest Neighbour) باختيار أسرع عبر مصفوفة المسافات
  function buildNearestNeighbourPath(
    startIdx: number | null,
    hasStartPoint: boolean
  ): number[] {
    const visited = new Uint8Array(N);
    const path: number[] = new Array(N);
    let count = 0;
    let currentIdx = -1;

    if (startIdx !== null) {
      visited[startIdx] = 1;
      path[0] = startIdx;
      count = 1;
      currentIdx = startIdx;
    } else if (hasStartPoint && startDist) {
      // البحث عن المحطة الأقرب لنقطة البداية الخارجية
      let bestNext = -1;
      let minD = Infinity;
      for (let j = 0; j < N; j++) {
        const d = startDist[j];
        if (d < minD - 1e-9) {
          minD = d;
          bestNext = j;
        } else if (Math.abs(d - minD) <= 1e-9) {
          if (
            bestNext === -1 ||
            locatedWithIdx[j].origIdx < locatedWithIdx[bestNext].origIdx
          ) {
            bestNext = j;
          }
        }
      }
      visited[bestNext] = 1;
      path[0] = bestNext;
      count = 1;
      currentIdx = bestNext;
    } else {
      visited[0] = 1;
      path[0] = 0;
      count = 1;
      currentIdx = 0;
    }

    while (count < N) {
      let bestNext = -1;
      let minD = Infinity;
      const rowOffset = currentIdx * N;

      for (let j = 0; j < N; j++) {
        if (visited[j]) continue;
        const d = distMatrix[rowOffset + j];
        if (d < minD - 1e-9) {
          minD = d;
          bestNext = j;
        } else if (Math.abs(d - minD) <= 1e-9) {
          if (
            bestNext === -1 ||
            locatedWithIdx[j].origIdx < locatedWithIdx[bestNext].origIdx
          ) {
            bestNext = j;
          }
        }
      }

      if (bestNext === -1) break;
      visited[bestNext] = 1;
      path[count++] = bestNext;
      currentIdx = bestNext;
    }

    return path;
  }

  // دالة تحسين المسار المفتوح بـ 2-opt باستخدام الفرق O(1) وتبديل المصفوفة في مكانها دون تخصيص ذاكرة
  function run2Opt(path: number[], hasStart: boolean): void {
    let improved = true;
    let iterations = 0;
    const maxIterations = 200;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 0; i < N - 1; i++) {
        for (let j = i + 1; j < N; j++) {
          const u = path[i];
          const v = path[j];

          // الضلع القادم إلى i والضلع المغادر لـ j
          let oldEdge = 0;
          let newEdge = 0;

          if (i > 0) {
            const prev = path[i - 1];
            oldEdge += distMatrix[prev * N + u];
            newEdge += distMatrix[prev * N + v];
          } else if (hasStart && startDist) {
            oldEdge += startDist[u];
            newEdge += startDist[v];
          }

          if (j < N - 1) {
            const nextNode = path[j + 1];
            oldEdge += distMatrix[v * N + nextNode];
            newEdge += distMatrix[u * N + nextNode];
          }

          const delta = newEdge - oldEdge;

          if (delta < -1e-9) {
            // عكس المقطع path[i..j] في مكانه
            let l = i;
            let r = j;
            while (l < r) {
              const tmp = path[l];
              path[l] = path[r];
              path[r] = tmp;
              l++;
              r--;
            }
            improved = true;
          }
        }
      }
    }
  }

  // دالة حساب إجمالي مسافة المسار المفتوح
  function computeTotalDist(path: number[], hasStart: boolean): number {
    let sum = 0;
    if (hasStart && startDist) {
      sum += startDist[path[0]];
    }
    for (let k = 0; k < N - 1; k++) {
      sum += distMatrix[path[k] * N + path[k + 1]];
    }
    return sum;
  }

  let bestPath: number[] = [];

  if (start) {
    // بوجود نقطة البداية: الجار الأقرب من start ثم 2-opt
    bestPath = buildNearestNeighbourPath(null, true);
    run2Opt(bestPath, true);
  } else {
    /*
      سقف العمل: البحث الشامل لجميع البدايات يعمل عندما N <= 25.
      أما إذا تجاوز N ذلك (N > 25)، فيتم اختيار 8 بدايات كحد أقصى: المحطة الأولى بالترتيب الأصلي
      و7 محطات الأبعد عن مركز الإحداثيات (عادةً ما تكون أطراف المسار)، مفرزة حسب الترتيب الأصلي لضمان الحتمية.
      هذا السقف يضمن إبقاء زمن المعالجة ممتازاً (< 50ms) دائماً حتى مع 60 محطة أو أكثر.
    */
    let candidateStarts: number[];
    if (N <= 25) {
      candidateStarts = Array.from({ length: N }, (_, idx) => idx);
    } else {
      let sumLat = 0;
      let sumLng = 0;
      for (let i = 0; i < N; i++) {
        sumLat += locatedWithIdx[i].lat;
        sumLng += locatedWithIdx[i].lng;
      }
      const centroid = { lat: sumLat / N, lng: sumLng / N };
      const withDist = locatedWithIdx.map((p, idx) => ({
        idx,
        origIdx: p.origIdx,
        dist: distanceKm(centroid, p),
      }));

      withDist.sort((a, b) => {
        if (Math.abs(b.dist - a.dist) > 1e-9) return b.dist - a.dist;
        return a.origIdx - b.origIdx;
      });

      const selectedSet = new Set<number>();
      selectedSet.add(0); // المحطة الأولى بالترتيب الأصلي

      for (const item of withDist) {
        if (selectedSet.size >= 8) break;
        selectedSet.add(item.idx);
      }

      candidateStarts = Array.from(selectedSet);
      candidateStarts.sort(
        (a, b) => locatedWithIdx[a].origIdx - locatedWithIdx[b].origIdx
      );
    }

    let bestDist = Infinity;

    for (const cIdx of candidateStarts) {
      const candPath = buildNearestNeighbourPath(cIdx, false);
      run2Opt(candPath, false);
      const dist = computeTotalDist(candPath, false);

      if (dist < bestDist - 1e-9) {
        bestDist = dist;
        bestPath = candPath;
      } else if (Math.abs(dist - bestDist) <= 1e-9) {
        if (
          bestPath.length === 0 ||
          locatedWithIdx[candPath[0]].origIdx < locatedWithIdx[bestPath[0]].origIdx
        ) {
          bestDist = dist;
          bestPath = candPath;
        }
      }
    }
  }

  // تجميع المحطات المُرتبة
  const orderedLocated = bestPath.map((idx) => locatedWithIdx[idx].item);
  const ordered = [...orderedLocated, ...unlocated];

  // حساب أطوال الساق (legsKm)
  const legsKm: Array<number | null> = new Array(ordered.length).fill(null);

  for (let i = 0; i < orderedLocated.length; i++) {
    if (i === 0) {
      if (start && startDist) {
        legsKm[0] = startDist[bestPath[0]];
      } else {
        legsKm[0] = null;
      }
    } else {
      legsKm[i] = distMatrix[bestPath[i - 1] * N + bestPath[i]];
    }
  }

  return { ordered, legsKm };
}
