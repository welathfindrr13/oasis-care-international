import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateVisitInput } from "./create-visit.input";

function inputWithTasks(tasks?: Array<{ taskName: string }>) {
  return plainToInstance(CreateVisitInput, {
    carerId: "11111111-1111-4111-8111-111111111111",
    clientId: "22222222-2222-4222-8222-222222222222",
    scheduledStart: "2026-08-05T09:00:00.000Z",
    scheduledEnd: "2026-08-05T10:00:00.000Z",
    tasks,
  });
}

describe("CreateVisitInput care-task bounds", () => {
  it.each([
    ["omitted", undefined],
    ["zero", []],
    ["one", [{ taskName: "Support with breakfast" }]],
    [
      "twenty",
      Array.from({ length: 20 }, (_, index) => ({
        taskName: `Care task ${index + 1}`,
      })),
    ],
  ])("accepts %s care tasks", async (_case, tasks) => {
    await expect(validate(inputWithTasks(tasks))).resolves.toEqual([]);
  });

  it("trims a valid care-task label", async () => {
    const input = inputWithTasks([{ taskName: "  Support with breakfast  " }]);

    await expect(validate(input)).resolves.toEqual([]);
    expect(input.tasks?.[0].taskName).toBe("Support with breakfast");
  });

  it.each([
    ["blank", [{ taskName: "   " }]],
    ["too long", [{ taskName: "x".repeat(121) }]],
    [
      "too many",
      Array.from({ length: 21 }, (_, index) => ({
        taskName: `Care task ${index + 1}`,
      })),
    ],
  ])("rejects %s care-task input", async (_case, tasks) => {
    const errors = await validate(inputWithTasks(tasks));
    expect(errors.some((error) => error.property === "tasks")).toBe(true);
  });

  it("allows duplicate care-task labels", async () => {
    await expect(
      validate(
        inputWithTasks([
          { taskName: "Offer a drink" },
          { taskName: "Offer a drink" },
        ]),
      ),
    ).resolves.toEqual([]);
  });
});
