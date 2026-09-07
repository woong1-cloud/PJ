import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// 런칭 라우트가 문지기를 안 부르고 나가는 것을 막는다.
//
// 지금까지는 문이 하나(전체 관리자)라 빠뜨려도 티가 안 났다. 참여자에게
// 문을 열면(3·4단계) 한 군데만 빠뜨려도 뚫린다 — 그리고 RLS 가 없어서
// 데이터베이스가 받쳐 주지 않는다. 33개 마이그레이션 중 RLS 를 말하는
// 것이 하나뿐이고, 권한은 전부 라우트 핸들러가 service-role 로 처리한다.
//
// 그래서 사람의 기억이 아니라 테스트가 강제한다. 새 라우트를 만들면서
// 문지기를 안 부르면 여기서 걸린다.
//
// 스펙: docs/superpowers/specs/2026-09-07-launch-participants-design.md §5

const ROOT = join(process.cwd(), 'app', 'api', 'launch');

// 문지기로 인정하는 것들.
//
// requireLaunchAccess 는 3단계에서 생긴다 — 미리 적어 두어 그때 이 목록을
// 고치는 것을 잊지 않게 한다.
const GUARDS = ['requireGlobalAdmin', 'requireLaunchAccess'];

const HTTP = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'];

// 쓰는 손. 읽기는 범위를 안 걸어도 남의 것이 안 나오지만(id 로 못 찾으면
// 빈 결과다), 쓰기는 범위가 없으면 남의 것을 고친다.
const WRITES = ['POST', 'PATCH', 'PUT', 'DELETE'];

function routeFiles(dir = ROOT, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, out);
    else if (entry.name === 'route.js') out.push(full);
  }
  return out;
}

// 파일을 핸들러별 구간으로 자른다.
//
// 중괄호를 세지 않는다 — 주석과 템플릿 문자열에 든 중괄호까지 세야 해서
// 틀리기 쉽다. export 선언 사이를 그 핸들러의 구간으로 본다. 사이에 도우미
// 함수가 끼면 앞 핸들러 구간에 붙지만, 도우미가 문지기를 부르지는 않으므로
// 못 잡는 쪽(거짓 통과)이 아니라 넉넉한 쪽으로만 틀린다.
function handlers(source) {
  const marks = [];
  const re = /export\s+(?:async\s+)?function\s+([A-Z]+)\s*\(/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    if (HTTP.includes(m[1])) marks.push({ method: m[1], at: m.index });
  }
  return marks.map((mark, i) => ({
    method: mark.method,
    body: source.slice(mark.at, marks[i + 1]?.at ?? source.length),
  }));
}

const files = routeFiles();
const rel = (f) => relative(process.cwd(), f).split(sep).join('/');

describe('런칭 라우트 문지기', () => {
  it('라우트 파일을 찾는다 — 경로가 바뀌면 이 테스트가 조용히 0건이 된다', () => {
    // 파일을 하나도 못 찾으면 아래 검사가 전부 통과한다. 그 침묵이 가장
    // 위험하므로 개수부터 못박는다.
    expect(files.length).toBeGreaterThanOrEqual(15);
  });

  it.each(files.map((f) => [rel(f), f]))('%s — 모든 핸들러가 문지기를 부른다', (_name, file) => {
    const source = readFileSync(file, 'utf8');
    const found = handlers(source);
    expect(found.length).toBeGreaterThan(0);

    const naked = found
      .filter((h) => !GUARDS.some((g) => h.body.includes(`${g}(`)))
      .map((h) => h.method);

    expect(naked, `${rel(file)} 의 ${naked.join(', ')} 가 문지기를 안 부릅니다`).toEqual([]);
  });

  it.each(files.map((f) => [rel(f), f]))('%s — 문지기를 import 한다', (_name, file) => {
    const source = readFileSync(file, 'utf8');
    expect(GUARDS.some((g) => source.includes(g))).toBe(true);
  });
});

// 하위 자원을 제 id 로 짚는 라우트들.
//
// /launch/<A>/tasks/<T> 에서 T 가 정말 A 의 것인지 안 보면, 주소를 손으로
// 고쳐 남의 런칭 항목을 고칠 수 있다(IDOR). 지금은 전체 관리자만 들어와서
// 문제가 아니지만, 참여자가 들어오는 순간 문제가 된다.
const nested = files.filter((f) => {
  const parts = rel(f).split('/');
  // app/api/launch/[id]/tasks/[taskId]/route.js → [id] 뒤에 또 [ ] 가 있다
  const dyn = parts.filter((p) => p.startsWith('[') && p.endsWith(']'));
  return dyn.length >= 2;
});

describe('하위 자원이 부모 범위 안인지 본다', () => {
  it('그런 라우트가 실제로 있다', () => {
    // 0건이면 아래 each 가 통째로 안 돌고 조용히 통과한다.
    expect(nested.length).toBeGreaterThanOrEqual(3);
  });

  it.each(nested.map((f) => [rel(f), f]))('%s — 쓰는 핸들러가 부모로 범위를 건다', (_name, file) => {
    const name = rel(file);
    // 가이드 항목은 launch_id 가 없다. 그쪽은 guide_id 를 직접 견준다.
    const key = name.includes('/guides/') ? 'guide_id' : 'launch_id';
    const source = readFileSync(file, 'utf8');

    const loose = handlers(source)
      .filter((h) => WRITES.includes(h.method) && !h.body.includes(key))
      .map((h) => h.method);

    expect(loose, `${name} 의 ${loose.join(', ')} 가 ${key} 로 범위를 안 겁니다`).toEqual([]);
  });
});
