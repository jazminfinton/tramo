import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadHistory } from "@/features/time/history";
import { PAGE_SIZE, type SearchParams } from "@/lib/pagination";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

const AR = "America/Argentina/Buenos_Aires"; // UTC-3
const at = (iso: string) => new Date(iso);

let db: TestDb;
let workspaceId: string;
let ana: string;
let beto: string;
let carla: string;
let web: string;
let app: string;
let elsewhere: string;
let design: string;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  ana = (await createUser(db, "ana@test.dev", "Ana")).id;
  beto = (await createUser(db, "beto@test.dev", "Beto")).id;
  carla = (await createUser(db, "carla@test.dev", "Carla")).id;
  workspaceId = (await db.prisma.workspace.create({ data: { name: "Test" } })).id;
  const otherWorkspace = (await db.prisma.workspace.create({ data: { name: "Other" } })).id;
  const project = (name: string, workspace = workspaceId) =>
    db.prisma.project.create({ data: { workspaceId: workspace, name, color: "blue" } }).then(({ id }) => id);
  web = await project("Web");
  app = await project("App");
  elsewhere = await project("Afuera", otherWorkspace);
  design = (
    await db.prisma.task.create({ data: { workspaceId, name: "Diseño", nameKey: "diseno", createdById: ana } })
  ).id;
  await db.prisma.projectMember.create({ data: { projectId: web, userId: ana, role: "TRACKER" } });
  await db.prisma.projectMember.create({ data: { projectId: web, userId: beto, role: "TRACKER" } });
});

function block(
  start: string,
  end: string | null,
  over: { userId?: string; projectId?: string; taskId?: string; description?: string; pausedSeconds?: number } = {},
) {
  return db.prisma.timeEntry.create({
    data: { userId: ana, projectId: web, startedAt: at(start), endedAt: end ? at(end) : null, ...over },
  });
}

const load = (params: SearchParams = {}, viewer: { userId?: string; isAdmin?: boolean } = {}) =>
  loadHistory(db.prisma, {
    workspaceId,
    userId: viewer.userId ?? ana,
    isAdmin: viewer.isAdmin ?? false,
    timeZone: AR,
    params,
    tasks: [{ id: design, name: "Diseño" }],
  });

const descriptions = async (params: SearchParams = {}) =>
  (await load(params))?.entries.map((entry) => entry.description);

describe("what the history shows", () => {
  it("lists finished blocks, newest first, with who logged them", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { description: "vieja" });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z", { description: "nueva", userId: beto });
    await block("2026-09-13T12:00:00Z", null, { description: "abierta" });

    const history = await load();

    expect(history?.entries.map((entry) => entry.description)).toEqual(["nueva", "vieja"]);
    expect(history?.entries[0]).toMatchObject({
      user: { id: beto, name: "Beto" },
      project: { name: "Web", color: "blue" },
      task: null,
      source: "TIMER",
      startedAt: at("2026-09-12T12:00:00Z"),
      endedAt: at("2026-09-12T13:00:00Z"),
      paidAt: null,
      editedAt: null,
    });
  });

  it("names the team task of a block", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { taskId: design });

    expect((await load())?.entries[0]).toMatchObject({ taskId: design, task: { name: "Diseño" } });
  });

  it("is everyone's hours in the projects a member belongs to, and only those", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { description: "mía" });
    await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { description: "de beto", userId: beto });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z", { description: "otro proyecto", projectId: app });
    await block("2026-09-13T12:00:00Z", "2026-09-13T13:00:00Z", { description: "otro espacio", projectId: elsewhere });

    expect(await descriptions()).toEqual(["de beto", "mía"]);
  });

  it("is the whole workspace for an admin, and no other", async () => {
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z", { description: "otro proyecto", projectId: app });
    await block("2026-09-13T12:00:00Z", "2026-09-13T13:00:00Z", { description: "otro espacio", projectId: elsewhere });

    const history = await load({}, { userId: carla, isAdmin: true });

    expect(history?.entries.map((entry) => entry.description)).toEqual(["otro proyecto"]);
  });

  it("is nothing for someone who sees no project", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z");

    expect(await load({}, { userId: carla })).toBeNull();
  });
});

describe("the list of people", () => {
  it("is whoever has hours in the projects on show, once each, by name", async () => {
    await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { userId: beto });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z");
    await block("2026-09-13T12:00:00Z", "2026-09-13T14:00:00Z");
    await block("2026-09-14T12:00:00Z", "2026-09-14T13:00:00Z", { userId: carla, projectId: app });

    expect((await load())?.people).toEqual([
      { id: ana, name: "Ana" },
      { id: beto, name: "Beto" },
    ]);
  });

  it("doesn't narrow with the filters, so another person is always one click away", async () => {
    await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { userId: beto });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z");

    expect((await load({ person: ana }))?.people).toHaveLength(2);
  });

  it("includes someone who left the project: their hours are still part of it", async () => {
    await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { userId: carla });

    expect((await load())?.people).toEqual([{ id: carla, name: "Carla" }]);
  });
});

describe("filtering", () => {
  beforeEach(async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { description: "Reunión de equipo", taskId: design });
    await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { description: "Landing", userId: beto });
    await block("2026-09-12T12:00:00Z", "2026-09-12T13:00:00Z", { description: "reunion con Beto", userId: beto, taskId: design });
  });

  it("goes by person", async () => {
    expect(await descriptions({ person: ana })).toEqual(["Reunión de equipo"]);
  });

  it("ignores a person who isn't on the list, instead of showing nothing", async () => {
    expect(await descriptions({ person: "nadie" })).toHaveLength(3);
    expect((await load({ person: "nadie" }))?.filters.person).toBeNull();
  });

  it("can't reach anyone's hours outside the projects on show", async () => {
    await block("2026-09-13T12:00:00Z", "2026-09-13T13:00:00Z", { description: "secreto", userId: carla, projectId: app });

    expect((await load({ person: carla }))?.entries.map((entry) => entry.description)).not.toContain("secreto");
  });

  it("goes by team task", async () => {
    expect(await descriptions({ task: design })).toEqual(["reunion con Beto", "Reunión de equipo"]);
  });

  it("ignores a team task that doesn't exist", async () => {
    expect((await load({ task: "nada" }))?.filters.task).toBeNull();
  });

  it("goes by days, whole ones", async () => {
    expect(await descriptions({ from: "2026-09-11", to: "2026-09-12" })).toEqual(["reunion con Beto", "Landing"]);
  });

  it("reads days on the viewer's clock", async () => {
    // 01:00 UTC on the 21st is still the 20th in Buenos Aires.
    await block("2026-09-21T01:00:00Z", "2026-09-21T02:00:00Z", { description: "de noche" });

    expect(await descriptions({ from: "2026-09-20", to: "2026-09-20" })).toEqual(["de noche"]);
    expect(await descriptions({ from: "2026-09-21", to: "2026-09-21" })).toEqual([]);
  });

  it("finds text without minding case or accents, either way", async () => {
    const both = ["reunion con Beto", "Reunión de equipo"];

    expect(await descriptions({ q: "reunion" })).toEqual(both);
    expect(await descriptions({ q: "REUNIÓN" })).toEqual(both);
    expect(await descriptions({ q: "nión" })).toEqual(both);
  });

  it("looks for text in what's written by hand, not in the team task", async () => {
    expect(await descriptions({ q: "diseño" })).toEqual([]);
  });

  it("takes % and _ as the characters they are", async () => {
    await block("2026-09-13T12:00:00Z", "2026-09-13T13:00:00Z", { description: "subió 100% el_total" });

    expect(await descriptions({ q: "100%" })).toEqual(["subió 100% el_total"]);
    expect(await descriptions({ q: "el_t" })).toEqual(["subió 100% el_total"]);
    expect(await descriptions({ q: "%" })).toEqual(["subió 100% el_total"]);
    expect(await descriptions({ q: "_" })).toEqual(["subió 100% el_total"]);
  });

  it("combines every filter", async () => {
    await block("2026-09-14T12:00:00Z", "2026-09-14T13:00:00Z", { description: "reunion tarde", userId: beto });

    expect(await descriptions({ person: beto, task: design, q: "reunion" })).toEqual(["reunion con Beto"]);
    expect(await descriptions({ person: beto, q: "reunion", from: "2026-09-14", to: "2026-09-30" })).toEqual([
      "reunion tarde",
    ]);
    expect(await descriptions({ person: ana, task: design, q: "landing" })).toEqual([]);
  });
});

describe("the totals", () => {
  it("add up what's filtered, with pauses left out", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T14:00:00Z", { pausedSeconds: 1800 });
    await block("2026-09-11T12:00:00Z", "2026-09-11T13:00:00Z", { userId: beto });

    expect(await load()).toMatchObject({ blocks: 2, minutes: 150 });
    expect(await load({ person: beto })).toMatchObject({ blocks: 1, minutes: 60 });
    expect(await load({ q: "nada" })).toMatchObject({ blocks: 0, minutes: 0 });
  });

  it("count every page, not just the one on show", async () => {
    await many(PAGE_SIZE + 5);

    const history = await load();

    expect(history?.entries).toHaveLength(PAGE_SIZE);
    expect(history).toMatchObject({ blocks: PAGE_SIZE + 5, minutes: (PAGE_SIZE + 5) * 60 });
  });
});

function many(count: number, start = "2026-01-01T12:00:00.000Z") {
  return db.prisma.timeEntry.createMany({
    data: Array.from({ length: count }, (_, index) => {
      const startedAt = new Date(new Date(start).getTime() + index * 86_400_000);
      return {
        userId: ana,
        projectId: web,
        description: `b${index}`,
        startedAt,
        endedAt: new Date(startedAt.getTime() + 3_600_000),
      };
    }),
  });
}

describe("paging", () => {
  it("walks forward and back with no block repeated or missed", async () => {
    await many(PAGE_SIZE * 2 + 3);

    const first = await load();
    const second = await load({ after: first?.nextCursor ?? "" });
    const third = await load({ after: second?.nextCursor ?? "" });
    const seen = [first, second, third].flatMap((page) => page?.entries.map((entry) => entry.description) ?? []);

    expect(new Set(seen).size).toBe(PAGE_SIZE * 2 + 3);
    expect(seen[0]).toBe(`b${PAGE_SIZE * 2 + 2}`);
    expect(seen.at(-1)).toBe("b0");
    expect(first?.prevCursor).toBeNull();
    expect(third?.nextCursor).toBeNull();

    const back = await load({ before: third?.prevCursor ?? "" });
    expect(back?.entries.map((entry) => entry.description)).toEqual(
      second?.entries.map((entry) => entry.description),
    );
    expect(back?.nextCursor).toBe(second?.nextCursor);
  });

  it("doesn't lose blocks that started at the same moment", async () => {
    await db.prisma.timeEntry.createMany({
      data: Array.from({ length: PAGE_SIZE + 4 }, (_, index) => ({
        userId: ana,
        projectId: web,
        description: `t${index}`,
        startedAt: at("2026-09-10T12:00:00Z"),
        endedAt: at("2026-09-10T13:00:00Z"),
      })),
    });

    const first = await load();
    const second = await load({ after: first?.nextCursor ?? "" });
    const seen = [first, second].flatMap((page) => page?.entries.map((entry) => entry.description) ?? []);

    expect(new Set(seen).size).toBe(PAGE_SIZE + 4);
  });

  it("stays within the filters", async () => {
    await many(PAGE_SIZE + 2);
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { description: "de beto", userId: beto });

    const first = await load({ person: ana });
    const second = await load({ person: ana, after: first?.nextCursor ?? "" });

    expect(second?.entries).toHaveLength(2);
    expect(second?.entries.every((entry) => entry.user.id === ana)).toBe(true);
  });

  it("starts over when the block it stood on is gone", async () => {
    await block("2026-09-10T12:00:00Z", "2026-09-10T13:00:00Z", { description: "sigue" });

    const history = await load({ after: "ya-no-existe" });

    expect(history?.entries.map((entry) => entry.description)).toEqual(["sigue"]);
    expect(history?.prevCursor).toBeNull();
  });
});

describe("the cost", () => {
  it("is the same few statements, whatever the filters and however many blocks", async () => {
    await many(PAGE_SIZE + 5);
    await block("2026-06-01T12:00:00Z", "2026-06-01T13:00:00Z", { description: "b con tarea", taskId: design });

    const plain = await db.statementsOf(() => load());
    const filtered = await db.statementsOf(() =>
      load({ person: ana, from: "2026-01-01", to: "2026-12-31", q: "b", task: design }),
    );

    expect(plain).toHaveLength(4);
    expect(filtered).toHaveLength(4);
  });

  it("asks for less when there's nothing to show", async () => {
    expect(await db.statementsOf(() => load({}, { userId: carla }))).toHaveLength(1);
    expect(await db.statementsOf(() => load({ q: "nada" }))).toHaveLength(3);
  });
});
