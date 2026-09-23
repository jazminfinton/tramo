import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listTeamEntries } from "@/features/time/team";
import { createTestDb, createUser, type TestDb } from "@/lib/testing/db";

const week = { start: new Date("2026-09-21T03:00:00Z"), end: new Date("2026-09-28T03:00:00Z") };

let db: TestDb;
let workspaceId: string;
let people: Record<"ana" | "beto" | "carla" | "dario", string>;
let projects: Record<"web" | "app" | "foreign", string>;

beforeAll(async () => {
  db = await createTestDb();
});

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  await db.reset();
  const [ana, beto, carla, dario] = await Promise.all(
    ["ana", "beto", "carla", "dario"].map((name) => createUser(db, `${name}@test.dev`, name)),
  );
  people = { ana: ana!.id, beto: beto!.id, carla: carla!.id, dario: dario!.id };

  const workspace = await db.prisma.workspace.create({ data: { name: "Test" } });
  const other = await db.prisma.workspace.create({ data: { name: "Other" } });
  workspaceId = workspace.id;
  const project = (workspace: string, name: string) =>
    db.prisma.project.create({ data: { workspaceId: workspace, name, color: "blue" } }).then(({ id }) => id);
  projects = {
    web: await project(workspace.id, "Web"),
    app: await project(workspace.id, "App"),
    foreign: await project(other.id, "Foreign"),
  };

  await db.prisma.projectMember.createMany({
    data: [
      { projectId: projects.web, userId: people.ana, role: "TRACKER" },
      { projectId: projects.web, userId: people.carla, role: "VIEWER" },
      { projectId: projects.app, userId: people.beto, role: "TRACKER" },
    ],
  });

  const block = (userId: string, projectId: string, description: string, start: string, hours = 1) => ({
    userId,
    projectId,
    description,
    startedAt: new Date(start),
    endedAt: new Date(new Date(start).getTime() + hours * 3_600_000),
  });
  await db.prisma.timeEntry.createMany({
    data: [
      block(people.ana, projects.web, "Login", "2026-09-22T12:00:00Z", 2),
      // Dario left the project, but what he logged there stays part of it.
      block(people.dario, projects.web, "Deploy", "2026-09-21T13:00:00Z"),
      block(people.beto, projects.app, "API", "2026-09-23T12:00:00Z"),
      block(people.beto, projects.foreign, "Elsewhere", "2026-09-23T15:00:00Z"),
      block(people.ana, projects.web, "Last week", "2026-09-15T12:00:00Z"),
    ],
  });
});

const descriptionsFor = async (userId: string, isAdmin = false) =>
  (await listTeamEntries(db.prisma, { workspaceId, userId, isAdmin, ...week })).map((entry) => entry.description);

describe("listTeamEntries", () => {
  it("shows an observer every block in the projects they observe, whoever logged it, oldest first", async () => {
    expect(await descriptionsFor(people.carla)).toEqual(["Deploy", "Login"]);
  });

  it("keeps each person to the projects they belong to", async () => {
    expect(await descriptionsFor(people.beto)).toEqual(["API"]);
    expect(await descriptionsFor(people.dario)).toEqual([]);
  });

  it("shows admins every project of their workspace, and nothing from others", async () => {
    expect(await descriptionsFor(people.dario, true)).toEqual(["Deploy", "Login", "API"]);
  });

  it("says who logged each block and where", async () => {
    const [first] = await listTeamEntries(db.prisma, { workspaceId, userId: people.carla, isAdmin: false, ...week });
    expect(first).toMatchObject({
      description: "Deploy",
      user: { id: people.dario, name: "dario" },
      project: { name: "Web", color: "blue" },
    });
  });
});
