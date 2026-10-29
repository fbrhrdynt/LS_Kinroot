// Rectilinear visibility routing: shortest Manhattan route with a bend penalty.
export function intersects(a, b, r) {
  if (a[0] === b[0])
    return (
      a[0] > r.x &&
      a[0] < r.x + r.w &&
      Math.max(a[1], b[1]) > r.y &&
      Math.min(a[1], b[1]) < r.y + r.h
    );
  return (
    a[1] > r.y &&
    a[1] < r.y + r.h &&
    Math.max(a[0], b[0]) > r.x &&
    Math.min(a[0], b[0]) < r.x + r.w
  );
}
export function route(points, rects) {
  if (
    !points
      .slice(1)
      .some((b, i) => rects.some((r) => intersects(points[i], b, r)))
  )
    return points;
  const a = points[0],
    b = points.at(-1),
    xs = [
      ...new Set([
        a[0],
        b[0],
        ...rects.flatMap((r) => [r.x - 14, r.x + r.w + 14]),
      ]),
    ].sort((a, b) => a - b),
    ys = [
      ...new Set([
        a[1],
        b[1],
        ...rects.flatMap((r) => [r.y - 14, r.y + r.h + 14]),
      ]),
    ].sort((a, b) => a - b);
  // Grid can be large for giant imported families; use graph-local obstacles only.
  if (xs.length * ys.length > 120000) return points;
  const index = (x, y) => y * xs.length + x,
    coords = (k) => [xs[k % xs.length], ys[Math.floor(k / xs.length)]],
    start = index(xs.indexOf(a[0]), ys.indexOf(a[1])),
    goal = index(xs.indexOf(b[0]), ys.indexOf(b[1]));
  const queue = [{ k: start, dir: 0, cost: 0, score: 0 }],
    best = new Map([[start + ":0", 0]]),
    prev = new Map();
  let end;
  while (queue.length) {
    queue.sort((a, b) => b.score - a.score);
    const cur = queue.pop();
    if (cur.k === goal) {
      end = cur;
      break;
    }
    const x = cur.k % xs.length,
      y = Math.floor(cur.k / xs.length),
      from = coords(cur.k);
    for (const [nx, ny, dir] of [
      [x - 1, y, 1],
      [x + 1, y, 1],
      [x, y - 1, 2],
      [x, y + 1, 2],
    ]) {
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      const k = index(nx, ny),
        to = coords(k);
      if (rects.some((r) => intersects(from, to, r))) continue;
      const cost =
          cur.cost +
          Math.abs(from[0] - to[0]) +
          Math.abs(from[1] - to[1]) +
          (cur.dir && cur.dir !== dir ? 18 : 0),
        key = k + ":" + dir;
      if (cost >= (best.get(key) ?? Infinity)) continue;
      best.set(key, cost);
      prev.set(key, cur);
      queue.push({
        k,
        dir,
        cost,
        score: cost + Math.abs(to[0] - b[0]) + Math.abs(to[1] - b[1]),
      });
    }
  }
  if (!end) return points;
  const result = [];
  while (end) {
    result.push(coords(end.k));
    end = prev.get(end.k + ":" + end.dir);
  }
  result.reverse();
  return result.filter(
    (p, i) =>
      !i ||
      i === result.length - 1 ||
      !(
        (result[i - 1][0] === p[0] && p[0] === result[i + 1][0]) ||
        (result[i - 1][1] === p[1] && p[1] === result[i + 1][1])
      ),
  );
}
