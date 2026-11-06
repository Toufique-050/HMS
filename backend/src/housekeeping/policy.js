export const CHECKLIST = Object.freeze([
    ["linen", "Bed and linen checked"],
    ["bathroom", "Bathroom cleaned"],
    ["surfaces", "Surfaces cleaned"],
    ["floor", "Floor cleaned"],
    ["bins", "Bins emptied"],
    ["supplies", "Towels and supplies replenished"]
]);
export const canReadTask = (task, actor) =>
    String(task.hotelId) === String(actor.hotelId) && String(task.assignedTo) === String(actor._id);
export const canReadIssue = (issue, actor) =>
    String(issue.hotelId) === String(actor.hotelId) &&
    [issue.assignedTo, issue.reportedBy].some(key => key && String(key) === String(actor._id));
export const canWorkIssue = (issue, actor) =>
    String(issue.hotelId) === String(actor.hotelId) && String(issue.assignedTo) === String(actor._id);
export function requireTransition(current, next) {
    if (!({ pending: ["in_progress"], in_progress: ["completed"] })[current]?.includes(next)) {
        const error = new Error("Task status changed or transition is invalid. Refresh your tasks.");
        error.status = 409; throw error;
    }
}
export function requireChecklist(checklist) {
    if (!CHECKLIST.every(([key]) => checklist?.[key] === true)) {
        const error = new Error("Complete every cleaning checklist item before finishing the task.");
        error.status = 400; throw error;
    }
}
export function nextCleaningState(otherTasks) {
    if (otherTasks.some(task => task.status === "in_progress")) return "cleaning";
    if (otherTasks.some(task => task.status === "pending")) return "dirty";
    return "clean";
}
