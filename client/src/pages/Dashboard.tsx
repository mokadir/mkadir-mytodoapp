import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useAuth } from "../context/AuthContext";
import { todosApi, type Todo, type Tag } from "../lib/todos";
import { projectsApi, type Project } from "../lib/projects";
import { SortableTodoCard } from "../components/SortableTodoCard";
import { AddTodoForm } from "../components/AddTodoForm";
import { ConfirmModal } from "../components/ConfirmModal";
import { useToast } from "../components/Toast";
import { ProfilePage } from "./ProfilePage";

type FilterType = "all" | "active" | "completed";

const TAG_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
];

const PROJECT_COLORS = [
  "#3B82F6", // blue
  "#EF4444", // red
  "#10B981", // green
  "#F59E0B", // amber
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
];

export function Dashboard() {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [showProfile, setShowProfile] = useState(false);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tag manager state
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [tagDeleteTarget, setTagDeleteTarget] = useState<string | null>(null);

  // Project manager state
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(PROJECT_COLORS[0]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectDeleteTarget, setProjectDeleteTarget] = useState<string | null>(null);

  // Fetch todos
  const fetchTodos = useCallback(async () => {
    try {
      const data = await todosApi.getAll();
      setTodos(data.todos);
      setError("");
    } catch (err) {
      setError("Failed to load todos");
      showToast("Failed to load todos", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Fetch tags
  const fetchTags = useCallback(async () => {
    try {
      const data = await todosApi.getTags();
      setTags(data.tags);
    } catch {
      // Silently fail - tags are non-critical
    }
  }, []);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const data = await projectsApi.getAll();
      setProjects(data.projects);
      // Auto-select first project if none selected
      if (data.projects.length > 0 && !selectedProjectId) {
        setSelectedProjectId(data.projects[0].id);
      }
    } catch {
      // Silently fail - projects are non-critical
    }
  }, [selectedProjectId]);

  useEffect(() => {
    fetchTodos();
    fetchTags();
    fetchProjects();
  }, [fetchTodos, fetchTags, fetchProjects]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = todos.findIndex((t) => t.id === active.id);
    const newIndex = todos.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic reorder
    const reordered = [...todos];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setTodos(reordered);

    // Persist to backend
    try {
      await todosApi.reorder(reordered.map((t) => t.id));
    } catch {
      showToast("Failed to save order", "error");
      fetchTodos(); // Revert on failure
    }
  };

  // Add todo
  const handleAdd = async (title: string, priority: string, dueDate: string | null, tagIds?: string[]) => {
    const data = await todosApi.create({
      title,
      priority,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
      tagIds,
      projectId: selectedProjectId || undefined,
    });
    setTodos((prev) => [data.todo, ...prev]);
    showToast("Todo added successfully", "success");
  };

  // Toggle complete
  const handleToggle = async (id: string, completed: boolean) => {
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t))
    );
    try {
      await todosApi.update(id, { completed });
      showToast(completed ? "Todo completed" : "Todo reopened", "success");
    } catch {
      // Revert on failure
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t))
      );
      showToast("Failed to update todo", "error");
    }
  };

  // Update todo (inline edit)
  const handleUpdate = async (id: string, data: { title?: string; priority?: string; dueDate?: string | null }) => {
    const updated = await todosApi.update(id, data);
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updated.todo } : t))
    );
    showToast("Todo updated", "success");
  };

  // Delete todo (with confirmation)
  const handleDeleteRequest = (id: string) => {
    setDeleteTarget(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await todosApi.delete(deleteTarget);
      setTodos((prev) => prev.filter((t) => t.id !== deleteTarget));
      showToast("Todo deleted", "success");
    } catch {
      showToast("Failed to delete todo", "error");
      fetchTodos();
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  // Tag management
  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    setIsCreatingTag(true);
    try {
      const data = await todosApi.createTag({ name, color: newTagColor });
      setTags((prev) => [...prev, data.tag]);
      setNewTagName("");
      setNewTagColor(TAG_COLORS[0]);
      showToast(`Tag "${name}" created`, "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to create tag", "error");
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleDeleteTag = async (id: string) => {
    try {
      await todosApi.deleteTag(id);
      setTags((prev) => prev.filter((t) => t.id !== id));
      // Also remove this tag from all todos in local state
      setTodos((prev) =>
        prev.map((t) => ({
          ...t,
          tags: t.tags.filter((tag) => tag.id !== id),
        }))
      );
      showToast("Tag deleted", "success");
    } catch {
      showToast("Failed to delete tag", "error");
    }
    setTagDeleteTarget(null);
  };

  // Project management
  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name) return;

    setIsCreatingProject(true);
    try {
      const data = await projectsApi.create({ name, color: newProjectColor });
      setProjects((prev) => [...prev, data.project]);
      setSelectedProjectId(data.project.id);
      setNewProjectName("");
      setNewProjectColor(PROJECT_COLORS[0]);
      showToast(`Project "${name}" created`, "success");
    } catch (err: any) {
      showToast(err?.message || "Failed to create project", "error");
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await projectsApi.delete(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (selectedProjectId === id) {
        setSelectedProjectId(projects.length > 1 ? projects.find((p) => p.id !== id)?.id || null : null);
      }
      showToast("Project deleted", "success");
    } catch {
      showToast("Failed to delete project", "error");
    }
    setProjectDeleteTarget(null);
  };

  // Filter todos by project, status, and search query
  const filteredTodos = todos.filter((todo) => {
    // Project filter
    if (selectedProjectId && todo.projectId !== selectedProjectId) return false;
    // Status filter
    if (filter === "active" && todo.completed) return false;
    if (filter === "completed" && !todo.completed) return false;
    // Search filter (case-insensitive)
    if (searchQuery.trim() && !todo.title.toLowerCase().includes(searchQuery.toLowerCase().trim())) return false;
    return true;
  });

  const activeCount = todos.filter((t) => !t.completed && (!selectedProjectId || t.projectId === selectedProjectId)).length;
  const completedCount = todos.filter((t) => t.completed && (!selectedProjectId || t.projectId === selectedProjectId)).length;

  if (showProfile) {
    return <ProfilePage onBack={() => setShowProfile(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* ─── Navbar ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <h1 className="text-lg font-bold text-gray-900">Todo App</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProfile(true)}
              className="text-sm text-gray-500 hover:text-blue-600 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {user?.name || user?.email}
            </button>
            <button
              onClick={logout}
              className="text-sm text-gray-500 hover:text-red-600 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ───────────────────────────────────────── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* ─── Project Selector ─────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedProjectId(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
              selectedProjectId === null
                ? "bg-gray-800 text-white shadow-sm"
                : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            All
          </button>
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setSelectedProjectId(project.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                selectedProjectId === project.id
                  ? "text-white shadow-sm"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-gray-300"
              }`}
              style={
                selectedProjectId === project.id
                  ? { backgroundColor: project.color }
                  : {}
              }
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              {project.name}
              <span className="text-xs opacity-70">({project._count.todos})</span>
            </button>
          ))}
          <button
            onClick={() => setShowProjectManager(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-dashed border-gray-300 transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {/* Add Todo Form */}
        <AddTodoForm onAdd={handleAdd} tags={tags} />

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm border border-red-200">
            {error}
            <button onClick={fetchTodos} className="ml-2 underline hover:no-underline">
              Retry
            </button>
          </div>
        )}

        {/* ─── Filter & Stats Bar ───────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1">
            {(["all", "active", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                  filter === f
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "all" ? "All" : f === "active" ? "Active" : "Completed"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {activeCount} active, {completedCount} completed
            </span>
            {/* Tag Manager Button */}
            <button
              onClick={() => setShowTagManager(true)}
              className="text-sm text-gray-400 hover:text-blue-600 font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Manage Tags
            </button>
          </div>
        </div>

        {/* ─── Search Bar ────────────────────────────────────────── */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search todos by title..."
            className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                searchInputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ─── Todo List ─────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
              >
                <div className="h-4 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">
              {searchQuery.trim()
                ? `No todos match "${searchQuery.trim()}"`
                : filter === "all"
                ? "No todos yet. Add one above!"
                : filter === "active"
                ? "No active todos. Great job!"
                : "No completed todos yet."}
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredTodos.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 animate-fadeIn">
                {filteredTodos.map((todo) => (
                  <SortableTodoCard
                    key={todo.id}
                    todo={todo}
                    onToggle={handleToggle}
                    onDelete={handleDeleteRequest}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </main>

      {/* ─── Delete Confirmation Modal ──────────────────────────── */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        title="Delete Todo"
        message="Are you sure you want to delete this todo? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        isLoading={isDeleting}
      />

      {/* ─── Tag Manager Modal ──────────────────────────────────── */}
      {showTagManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowTagManager(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md animate-fadeIn">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Manage Tags</h2>
                <button
                  onClick={() => setShowTagManager(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Create Tag Form */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="New tag name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateTag();
                    }
                  }}
                />
                <div className="flex items-center gap-1">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-6 h-6 rounded-full transition-all duration-150 ${
                        newTagColor === color
                          ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleCreateTag}
                  disabled={isCreatingTag || !newTagName.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isCreatingTag ? "..." : "Add"}
                </button>
              </div>

              {/* Tag List */}
              {tags.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No tags yet. Create one above!
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{tag.name}</span>
                      </div>
                      <button
                        onClick={() => setTagDeleteTarget(tag.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete tag"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Tag Delete Confirmation ────────────────────────────── */}
      <ConfirmModal
        isOpen={tagDeleteTarget !== null}
        title="Delete Tag"
        message="Are you sure you want to delete this tag? It will be removed from all todos."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => tagDeleteTarget && handleDeleteTag(tagDeleteTarget)}
        onCancel={() => setTagDeleteTarget(null)}
      />

      {/* ─── Project Manager Modal ──────────────────────────────── */}
      {showProjectManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowProjectManager(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md animate-fadeIn">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Manage Projects</h2>
                <button
                  onClick={() => setShowProjectManager(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Create Project Form */}
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="New project name..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateProject();
                    }
                  }}
                />
                <div className="flex items-center gap-1">
                  {PROJECT_COLORS.slice(0, 6).map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewProjectColor(color)}
                      className={`w-6 h-6 rounded-full transition-all duration-150 ${
                        newProjectColor === color
                          ? "ring-2 ring-offset-2 ring-blue-500 scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleCreateProject}
                  disabled={isCreatingProject || !newProjectName.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                >
                  {isCreatingProject ? "..." : "Add"}
                </button>
              </div>

              {/* Project List */}
              {projects.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">
                  No projects yet. Create one above!
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">{project.name}</span>
                        <span className="text-xs text-gray-400">({project._count.todos})</span>
                      </div>
                      <button
                        onClick={() => setProjectDeleteTarget(project.id)}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete project"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Project Delete Confirmation ────────────────────────── */}
      <ConfirmModal
        isOpen={projectDeleteTarget !== null}
        title="Delete Project"
        message="Are you sure you want to delete this project? Todos in this project will become unassigned."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => projectDeleteTarget && handleDeleteProject(projectDeleteTarget)}
        onCancel={() => setProjectDeleteTarget(null)}
      />
    </div>
  );
}
