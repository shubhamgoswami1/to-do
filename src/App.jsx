import React, { useEffect, useMemo, useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { auth, db, loginWithGoogle, logout } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// --- Utilities ---
const priorities = ["Low", "Medium", "High", "Critical"];
const statusOptions = [
  { id: "todo", label: "To Do" },
  { id: "inprogress", label: "Development" },
  { id: "done", label: "Done" },
];

const defaultBoard = () => ({
  columnOrder: ["todo", "inprogress", "done"],
  columns: {
    todo: { id: "todo", title: "To Do", taskIds: [] },
    inprogress: { id: "inprogress", title: "Development", taskIds: [] },
    done: { id: "done", title: "Done", taskIds: [] },
  },
  tasks: {},
});

export default function App() {
  const [user, setUser] = useState(null);
  const [board, setBoard] = useState(defaultBoard);
  const [showNew, setShowNew] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "Medium",
    due: "",
    tags: "",
    status: "todo",
  });

  // 1) auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // 2) live Firestore subscription (per user)
  useEffect(() => {
    if (!user) {
      setBoard(defaultBoard());
      return;
    }
    const q = query(
      collection(db, "users", user.uid, "tasks"),
      orderBy("order", "desc") // newest first
    );
    const unsub = onSnapshot(q, (snap) => {
      const fresh = defaultBoard();
      const tasks = {};
      snap.forEach((d) => {
        const t = d.data();
        tasks[d.id] = {
          id: d.id,
          title: t.title || "Untitled",
          description: t.description || "",
          priority: t.priority || "Medium",
          due: t.due || "",
          tags: t.tags || [],
          columnId: t.columnId || "todo",
          createdAt: t.createdAt || Date.now(),
          order: t.order ?? 0,
        };
        // place into its column
        const col = tasks[d.id].columnId;
        if (fresh.columns[col]) fresh.columns[col].taskIds.push(d.id);
      });
      fresh.tasks = tasks;
      setBoard(fresh);
    });
    return () => unsub();
  }, [user]);

  // ------- Firestore helpers -------
  const tasksCol = user ? collection(db, "users", user.uid, "tasks") : null;
  const nowOrder = () => Date.now(); // used to order within columns (newest first)

  async function createTask(e) {
    e?.preventDefault?.();
    if (!user || !tasksCol) {
      alert("Please sign in to add tasks.");
      return;
    }
    const docData = {
      title: (newTask.title || "Untitled").trim(),
      description: (newTask.description || "").trim(),
      priority: newTask.priority,
      due: newTask.due,
      tags: newTask.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      columnId: newTask.status,
      createdAt: Date.now(),
      order: nowOrder(),
    };
    await addDoc(tasksCol, docData);
    setShowNew(false);
    setNewTask({
      title: "",
      description: "",
      priority: "Medium",
      due: "",
      tags: "",
      status: "todo",
    });
  }

  async function removeTask(id) {
    if (!user) return;
    await deleteDoc(doc(db, "users", user.uid, "tasks", id));
  }

  async function updateTask(id, partial) {
    if (!user) return;
    await updateDoc(doc(db, "users", user.uid, "tasks", id), partial);
  }

  async function moveTask(id, targetColId, positionIgnored = 0) {
    if (!user) return;
    // set new column and bump order so it appears on top
    await updateDoc(doc(db, "users", user.uid, "tasks", id), {
      columnId: targetColId,
      order: nowOrder(),
    });
  }

  // ------- DnD -------
  function onDragEnd(result) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    const from = source.droppableId;
    const to = destination.droppableId;
    if (from === to && source.index === destination.index) return;
    // just update in Firestore; snapshot will refresh UI
    moveTask(draggableId, to, destination.index);
  }

  // ------- search filter -------
  const normalizedQuery = queryText.toLowerCase();
  function visibleTaskIds(taskIds) {
    if (!normalizedQuery) return taskIds;
    return taskIds.filter((id) => {
      const t = board.tasks[id];
      const hay = `${t.title} ${t.description} ${t.tags?.join(" ")}`.toLowerCase();
      return hay.includes(normalizedQuery);
    });
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white text-slate-800">
      {/* Top Bar */}
      <header className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-xl">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl bg-slate-900 text-white">
              ✓
            </span>
            Kanban To‑Do
          </div>
          <div className="ml-auto flex items-center gap-2">
            <input
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 w-64"
              placeholder="Search tasks…"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
            {!user ? (
              <button
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm shadow hover:shadow-md transition"
                onClick={loginWithGoogle}
              >
                Sign in with Google
              </button>
            ) : (
              <button
                className="rounded-xl bg-white border border-slate-300 px-4 py-2 text-sm shadow hover:shadow-md transition"
                onClick={logout}
                title={user.email}
              >
                Sign out
              </button>
            )}
            <button
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm shadow hover:shadow-md transition disabled:opacity-50"
              onClick={() => (user ? setShowNew(true) : alert("Sign in first"))}
              disabled={!user}
            >
              New Task
            </button>
          </div>
        </div>
      </header>

      {/* Board */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {!user ? (
          <div className="text-slate-600">
            Please sign in with Google to sync your tasks across devices.
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {board.columnOrder.map((colId) => (
                <Column
                  key={colId}
                  column={board.columns[colId]}
                  tasks={board.tasks}
                  visibleTaskIds={visibleTaskIds}
                  onDelete={removeTask}
                  onUpdate={updateTask}
                  moveTask={moveTask}
                />
              ))}
            </div>
          </DragDropContext>
        )}
      </main>

      {/* New Task Modal */}
      {showNew && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowNew(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Add Task</h2>
              <button
                onClick={() => setShowNew(false)}
                className="text-slate-500 hover:text-slate-700"
              >
                ✕
              </button>
            </div>
            <form onSubmit={createTask} className="space-y-3">
              <input
                required
                autoFocus
                placeholder="Title"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask((s) => ({ ...s, title: e.target.value }))
                }
              />
              <textarea
                placeholder="Description"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={newTask.description}
                onChange={(e) =>
                  setNewTask((s) => ({ ...s, description: e.target.value }))
                }
              />
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Priority
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    value={newTask.priority}
                    onChange={(e) =>
                      setNewTask((s) => ({ ...s, priority: e.target.value }))
                    }
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Due date
                  </label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    value={newTask.due}
                    onChange={(e) =>
                      setNewTask((s) => ({ ...s, due: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Status
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    value={newTask.status}
                    onChange={(e) =>
                      setNewTask((s) => ({ ...s, status: e.target.value }))
                    }
                  >
                    {statusOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <input
                placeholder="Tags (comma separated)"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                value={newTask.tags}
                onChange={(e) =>
                  setNewTask((s) => ({ ...s, tags: e.target.value }))
                }
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-xl border border-slate-300"
                  onClick={() => setShowNew(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white shadow hover:shadow-md"
                >
                  Add task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------- Column --------
function Column({ column, tasks, visibleTaskIds, onDelete, onUpdate, moveTask }) {
  const ids = visibleTaskIds(column.taskIds);
  return (
    <div className="rounded-2xl bg-slate-100/70 border border-slate-200 p-3 md:p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">{column.title}</h3>
        <span className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-1">
          {column.taskIds.length}
        </span>
      </div>
      <Droppable droppableId={column.id} type="TASK">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`min-h-[200px] max-h-[70vh] overflow-y-auto rounded-xl p-1 transition ${
              snapshot.isDraggingOver ? "bg-slate-200" : "bg-transparent"
            }`}
          >
            {ids.map((taskId, index) => (
              <TaskCard
                key={taskId}
                task={tasks[taskId]}
                index={index}
                currentColumnId={column.id}
                onDelete={() => onDelete(taskId)}
                onUpdate={onUpdate}
                moveTask={moveTask}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

// -------- Task Card --------
function TaskCard({ task, index, currentColumnId, onDelete, onUpdate, moveTask }) {
  const priorityChip = useMemo(() => {
    const map = {
      Low: "bg-emerald-50 text-emerald-700 border-emerald-200",
      Medium: "bg-amber-50 text-amber-700 border-amber-200",
      High: "bg-orange-50 text-orange-700 border-orange-200",
      Critical: "bg-rose-50 text-rose-700 border-rose-200",
    };
    return map[task.priority] || "bg-slate-50 text-slate-700 border-slate-200";
  }, [task.priority]);

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`mb-2 rounded-2xl border p-3 bg-white shadow-sm hover:shadow transition select-none ${
            snapshot.isDragging ? "rotate-1 shadow-md" : ""
          }`}
        >
          <div className="flex items-start gap-2">
            <div
              className={`text-[10px] border px-2 py-0.5 rounded-full ${priorityChip}`}
            >
              {task.priority}
            </div>
            {task.due && (
              <div className="ml-auto text-[10px] bg-slate-50 border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                Due {task.due}
              </div>
            )}
          </div>
          <div className="mt-2">
            <div className="font-medium">{task.title}</div>
            {task.description && (
              <div className="text-sm text-slate-600 mt-1">{task.description}</div>
            )}
            {task.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {task.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick status buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="px-2.5 py-1 text-xs rounded-lg border"
              onClick={() => moveTask(task.id, "todo", 0)}
            >
              To Do
            </button>
            <button
              className="px-2.5 py-1 text-xs rounded-lg border"
              onClick={() => moveTask(task.id, "inprogress", 0)}
            >
              Development
            </button>
            <button
              className="px-2.5 py-1 text-xs rounded-lg border bg-emerald-600 text-white"
              onClick={() => moveTask(task.id, "done", 0)}
            >
              Done
            </button>
            <button
              className="ml-auto px-2.5 py-1 text-xs rounded-lg border"
              onClick={async () => {
                const title = prompt("Edit title", task.title);
                if (title == null) return;
                await onUpdate(task.id, { title });
              }}
            >
              Edit
            </button>
            <button
              className="px-2.5 py-1 text-xs rounded-lg border border-rose-300 text-rose-700"
              onClick={() => onDelete(task.id)}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
}